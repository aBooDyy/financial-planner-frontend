/**
 * Date math for the planning engine. Everything is parameterized by `today` (local midnight)
 * rather than reading the clock, so the funding plan is pure and testable. Dates on the wire
 * are ISO `YYYY-MM-DD` strings; these helpers convert at the edge.
 */

/** Today at local midnight — the single reference point the engine plans from. */
export const startOfToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Parse an ISO `YYYY-MM-DD` string to a local Date (defaults fill missing parts). */
export const parseISO = (s: string | null, fallback: Date): Date => {
  if (!s) return fallback
  const parts = s.split('-')
  const y = Number(parts[0]) || fallback.getFullYear()
  const m = (Number(parts[1]) || 1) - 1
  const d = parts[2] ? Number(parts[2]) : 1
  return new Date(y, m, d)
}

/** A Date → ISO `YYYY-MM-DD`. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Day-aware count of monthly set-asides still possible between `today` and a due date — at
 * least 1, so a goal due this month still spreads over one contribution.
 */
export const setAsidesLeft = (iso: string | null, today: Date): number => {
  const d = parseISO(iso, today)
  let months =
    (d.getFullYear() - today.getFullYear()) * 12 +
    (d.getMonth() - today.getMonth())
  if (d.getDate() < today.getDate()) months -= 1
  return Math.max(1, months)
}

/** Set-asides fall on this day of the month (1–28, so every month has one). */
export const clampSetAsideDay = (day: number | null | undefined): number =>
  Math.max(1, Math.min(28, Math.round(day ?? 1) || 1))

/** The first set-aside date on or after today: `day` this month, else next month. */
export const firstSetAsideDate = (today: Date, day: number): Date => {
  const d = clampSetAsideDay(day)
  const month = today.getDate() > d ? today.getMonth() + 1 : today.getMonth()
  return new Date(today.getFullYear(), month, d)
}

/** One month of a goal's plan, on the calendar. */
export type DatedSetAside = { date: string; amount: number }

/**
 * The engine's month-indexed schedule (index 0 = this month) placed on real dates: month `m`
 * is set aside `m` months after the first set-aside date. Amounts pass through untouched.
 */
export const datedSchedule = (
  schedule: ReadonlyArray<number>,
  today: Date,
  day: number,
): DatedSetAside[] => {
  const first = firstSetAsideDate(today, day)
  return schedule.map((amount, m) => ({
    date: ymd(
      new Date(first.getFullYear(), first.getMonth() + m, first.getDate()),
    ),
    amount,
  }))
}

/**
 * One goal as the time-phased planner sees it. All money is base-currency minor units; all
 * time is whole months from `today`. The planner never reads currencies or the clock — the
 * selector translates a goal into this shape and converts back.
 */
export type PlanTrack = {
  id: string
  position: number
  // openended funds: a steady monthly draw with no deadline, never "completes" (unless capped
  // by `target`). Everything else is `dated`: it owes `remaining` by `deadline`, and recurring
  // kinds refill for their next cycle once paid.
  steady: boolean
  monthly: number
  remaining: number
  deadline: number
  recurs: boolean
  cycleMonths: number
  cycleAmount: number
  target: number
  saved: number
}

/** What the simulation worked out for one goal. */
export type TrackPlan = {
  id: string
  // Set aside this month (month 0). The sum across goals never exceeds income.
  now: number
  // Largest monthly set-aside across the horizon — the pace a deferred goal ramps up to.
  peak: number
  // First month with a positive set-aside (0 = funded now); `horizon` if never funded.
  startsIn: number
  // Month index the current objective is met; null if not reached within the horizon.
  completesIn: number | null
  meetsDeadline: boolean
  // Received its full required pace this month (vs. deferred or only partially funded).
  fundedNow: boolean
  // Month-by-month set-aside from now until the goal is covered (index = months from today).
  // Populated for every kind — see how its end is chosen in the finalize pass below.
  schedule: number[]
  // Every month index at which this goal is covered: a single completion for a one-time / target
  // goal, or one per cycle for a recurring obligation (it's covered, then comes due again).
  completions: number[]
}

const PLAN_EPS = 1

/**
 * Time-phased funding. Walks forward month by month spending each month's income on goals in
 * earliest-deadline-first order (user priority breaks ties), each at the smooth pace needed to
 * finish by its own deadline. A goal whose income ran out this month is deferred — next month
 * its horizon is shorter, so its pace rises and it climbs the queue. The upshot: near
 * obligations are funded first, and later ones ramp up as the near ones complete.
 */
export function simulatePlan(
  tracks: PlanTrack[],
  incomeMonthly: number,
  horizon: number,
): TrackPlan[] {
  const st = tracks.map((t) => ({
    t,
    rem: t.remaining,
    dl: t.deadline,
    cum: 0,
    done: false,
  }))
  const out = new Map<string, TrackPlan>(
    tracks.map((t) => [
      t.id,
      {
        id: t.id,
        now: 0,
        peak: 0,
        startsIn: horizon,
        completesIn: null,
        meetsDeadline: t.steady,
        fundedNow: false,
        schedule: [],
        completions: [],
      },
    ]),
  )
  const sched = new Map<string, number[]>(
    tracks.map((t) => [t.id, new Array<number>(horizon).fill(0)]),
  )

  for (let m = 0; m < horizon; m++) {
    let cap = incomeMonthly
    const active = st.filter((s) => (s.t.steady ? !s.done : s.rem > PLAN_EPS))
    active.sort(
      (a, b) =>
        (a.t.steady ? Number.MAX_SAFE_INTEGER : a.dl) -
          (b.t.steady ? Number.MAX_SAFE_INTEGER : b.dl) ||
        a.t.position - b.t.position,
    )
    for (const s of active) {
      if (cap <= PLAN_EPS) break
      const give = s.t.steady
        ? Math.min(cap, s.t.monthly)
        : Math.min(cap, s.rem / Math.max(1, s.dl - m), s.rem)
      if (give <= 0) continue

      const o = out.get(s.t.id)
      if (!o) continue
      if (m === 0) o.now += give
      if (o.startsIn === horizon) o.startsIn = m
      if (give > o.peak) o.peak = give
      const row = sched.get(s.t.id)
      if (row) row[m] += give
      cap -= give
      s.cum += give

      if (s.t.steady) {
        if (s.t.target > PLAN_EPS && s.t.saved + s.cum >= s.t.target) {
          if (o.completesIn === null) o.completesIn = m
          o.completions.push(m)
          s.done = true
        }
        continue
      }
      s.rem -= give
      if (s.rem <= PLAN_EPS) {
        if (o.completesIn === null) o.completesIn = m
        o.completions.push(m)
        if (s.t.recurs) {
          s.rem = s.t.cycleAmount
          s.dl += s.t.cycleMonths
        } else {
          s.done = true
        }
      }
    }
  }

  for (const t of tracks) {
    const o = out.get(t.id)
    if (!o) continue
    if (t.steady) {
      o.meetsDeadline = true
      o.fundedNow = o.now >= t.monthly - PLAN_EPS
    } else {
      o.meetsDeadline = o.completesIn !== null && o.completesIn < t.deadline
      o.fundedNow = o.now >= t.remaining / Math.max(1, t.deadline) - PLAN_EPS
    }
  }

  // The global display horizon = the latest *finishing* goal's coverage (at least a year out).
  // A one-time / target goal sets how far the plan must reach; recurring obligations and ongoing
  // funds never end, so they extend their schedule to this horizon — that's how their repeating
  // draws stay visible and keep weighing on the other goals up to the last goal's date.
  const finishes = (t: PlanTrack) =>
    !t.recurs && (!t.steady || t.target > PLAN_EPS)
  let coverEnd = 11
  for (const t of tracks) {
    if (!finishes(t)) continue
    const o = out.get(t.id)
    if (o) coverEnd = Math.max(coverEnd, o.completesIn ?? t.deadline)
  }
  coverEnd = Math.min(coverEnd, horizon - 1)

  for (const t of tracks) {
    const o = out.get(t.id)
    if (!o) continue
    // A finishing goal stops once it's covered; everything ongoing runs to the global horizon.
    const end = finishes(t)
      ? (o.completesIn ?? Math.min(horizon - 1, Math.max(0, t.deadline - 1)))
      : coverEnd
    o.schedule = (sched.get(t.id) ?? []).slice(0, end + 1)
  }
  return [...out.values()]
}
