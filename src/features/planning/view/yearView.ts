/**
 * Year ahead's lanes and month cards (04 §5, design §5): which month column each marker,
 * ramp and goal bar falls in, and what a month holds. Pure, over `buildYearAhead`.
 */
import type { LocalBill, LocalGoal } from '#/db/types'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { GoalStatus } from '#/features/planning/data/status'
import type { YearAhead, YearMonth } from '#/features/planning/data/yearAhead'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { dayMonth, money, monthYear, perPeriod } from './format'
import { repeatLabel } from './repeat'

/** The column of `iso`'s month: −1 before the window, `months.length` after it. */
export function monthIndex(
  months: ReadonlyArray<YearMonth>,
  iso: string,
): number {
  const key = iso.slice(0, 7)
  if (months.length === 0) return -1
  if (key < months[0].month) return -1
  const i = months.findIndex((m) => m.month === key)
  return i < 0 ? months.length : i
}

/** "Nov"; the year under the first month and every January. */
export function monthHead(
  months: ReadonlyArray<YearMonth>,
  i: number,
): { name: string; year: string | null } {
  const iso = `${months[i].month}-01`
  const [name, year] = monthYear(iso).split(' ')
  return {
    name,
    year: i === 0 || months[i].month.endsWith('-01') ? year : null,
  }
}

/**
 * The Bills and Goals group heads' notes: what the bills covered from each paycheck cost a
 * month, and what goals set aside a paycheck. Null when there is nothing to say.
 */
export function groupNotes(
  ahead: YearAhead,
  bills: ReadonlyArray<LocalBill>,
  goals: ReadonlyArray<LocalGoal>,
  base: CurrencyCode,
  rates: RatesMap,
  calendar: PayCalendar,
): { bills: string | null; goals: string | null } {
  const monthlyIds = new Set(
    ahead.months.flatMap((m) => m.monthlyBills.items.map((i) => i.billId)),
  )
  const monthly = bills
    .filter((b) => monthlyIds.has(b.id) && b.frequency)
    .reduce(
      (sum, b) =>
        sum +
        (convertMinor(b.amount, b.currency, base, rates) *
          frequencyMetaOf(b, 'monthly').perYear) /
          12,
      0,
    )
  const pace = ahead.goals.reduce((sum, y) => {
    const goal = goals.find((g) => g.id === y.goalId)
    return goal
      ? sum + convertMinor(y.perPaycheck, goal.currency, base, rates)
      : sum
  }, 0)
  return {
    bills: monthly > 0 ? `${money(monthly, base)} a month` : null,
    goals: pace > 0 ? `${money(pace, base)} ${perPeriod(calendar)}` : null,
  }
}

export type BillLane = {
  billId: string
  name: string
  color: string
  sub: string
  markers: Array<{ index: number; amount: string; date: string }>
  ramps: Array<{ from: number; to: number; progress: number; title: string }>
}

/** One lane per bill saved up for: its due markers and the ramps before them. */
export function billLanes(
  ahead: YearAhead,
  bills: ReadonlyArray<LocalBill>,
  calendar: PayCalendar,
): BillLane[] {
  const lanes = new Map<string, BillLane>()
  const laneOf = (billId: string) => {
    const bill = bills.find((b) => b.id === billId)
    if (!bill) return null
    let lane = lanes.get(billId)
    if (!lane) {
      lane = {
        billId,
        name: bill.name,
        color: bill.color,
        sub: `${repeatLabel(bill)} · ${money(bill.amount, bill.currency)}`,
        markers: [],
        ramps: [],
      }
      lanes.set(billId, lane)
    }
    return { lane, bill }
  }
  ahead.months.forEach((m, index) => {
    for (const b of m.bigBills) {
      const found = laneOf(b.billId)
      if (!found) continue
      found.lane.markers.push({
        index,
        amount: money(b.amount, found.bill.currency),
        date: dayMonth(b.occurrence),
      })
    }
  })
  for (const r of ahead.ramps) {
    const found = laneOf(r.billId)
    if (!found) continue
    const from = Math.max(0, monthIndex(ahead.months, r.from))
    const to = monthIndex(ahead.months, r.occurrence) - 1
    if (to < from) continue
    found.lane.ramps.push({
      from,
      to,
      progress: r.amount > 0 ? Math.min(1, r.setAside / r.amount) : 0,
      title: `Setting aside ${money(r.perPaycheck, found.bill.currency)} ${perPeriod(calendar)}`,
    })
  }
  return [...lanes.values()]
}

export type MonthlyBillLane = {
  billId: string
  name: string
  color: string
  sub: string
  /** Per month column, the dates it falls due there ("Oct 1"); empty when none. */
  dates: string[][]
}

/** One lane per bill covered from each paycheck, under the Monthly bills total. */
export function monthlyBillLanes(
  ahead: YearAhead,
  bills: ReadonlyArray<LocalBill>,
): MonthlyBillLane[] {
  const lanes = new Map<string, MonthlyBillLane>()
  ahead.months.forEach((m, index) => {
    for (const item of m.monthlyBills.items) {
      const bill = bills.find((b) => b.id === item.billId)
      if (!bill) continue
      let lane = lanes.get(bill.id)
      if (!lane) {
        lane = {
          billId: bill.id,
          name: bill.name,
          color: bill.color,
          sub: `${repeatLabel(bill)} · ${money(bill.amount, bill.currency)}`,
          dates: ahead.months.map(() => []),
        }
        lanes.set(bill.id, lane)
      }
      lane.dates[index].push(dayMonth(item.occurrence))
    }
  })
  return [...lanes.values()]
}

export type GoalLane = {
  goalId: string
  name: string
  color: string
  /** "SR 5,500 of SR 13,000", or "SR 800 saved" without a target. */
  sub: string
  /** Inclusive month columns; null when the plan sets nothing aside in the window. */
  span: { from: number; to: number } | null
  label: string
  target: { index: number; amount: string } | null
  slips: boolean
  paused: boolean
}

export function goalLanes(
  ahead: YearAhead,
  goals: ReadonlyArray<LocalGoal>,
  calendar: PayCalendar,
  status: Readonly<Record<string, Pick<GoalStatus, 'progress'> | undefined>>,
): GoalLane[] {
  const last = ahead.months.length - 1
  return ahead.goals.flatMap((y) => {
    const goal = goals.find((g) => g.id === y.goalId)
    if (!goal) return []
    const from = y.from ? Math.max(0, monthIndex(ahead.months, y.from)) : 0
    const end = y.finish ? monthIndex(ahead.months, y.finish) : last
    const to = Math.min(last, end)
    const pace = `${money(y.perPaycheck, goal.currency)} ${perPeriod(calendar)}`
    const label = y.paused
      ? 'Paused'
      : y.slips && y.slipsTo
        ? `${pace} · slips to ${monthYear(y.slipsTo)}`
        : !goal.target
          ? `${pace} · ongoing`
          : y.finish && end > last
            ? `${pace} · done ${monthYear(y.finish)}`
            : pace
    const targetIndex = y.target ? monthIndex(ahead.months, y.target) : -1
    const saved = money(status[goal.id]?.progress ?? 0, goal.currency)
    return [
      {
        goalId: y.goalId,
        name: goal.name,
        color: goal.color,
        sub: goal.target
          ? `${saved} of ${money(goal.target, goal.currency)}`
          : `${saved} saved`,
        span: y.from || y.paused ? { from, to: Math.max(from, to) } : null,
        label,
        target:
          targetIndex >= 0 && targetIndex <= last && goal.target
            ? { index: targetIndex, amount: money(goal.target, goal.currency) }
            : null,
        slips: y.slips,
        paused: y.paused,
      },
    ]
  })
}

export type MonthLine = {
  key: string
  kind: 'bill' | 'goal' | 'monthly'
  ownerId: string | null
  name: string
  note: string
  amount: string
  color: string
  setAside: boolean
}

/** Everything one month holds, for its popover and its mobile card. */
export function monthLines(
  m: YearMonth,
  bills: ReadonlyArray<LocalBill>,
  goals: ReadonlyArray<LocalGoal>,
  base: CurrencyCode,
): MonthLine[] {
  const nameOf = (kind: 'bill' | 'goal', id: string) =>
    kind === 'bill'
      ? bills.find((b) => b.id === id)
      : goals.find((g) => g.id === id)
  const lines: MonthLine[] = []
  if (m.monthlyBills.items.length > 0)
    lines.push({
      key: 'monthly',
      kind: 'monthly',
      ownerId: null,
      name: 'Monthly bills',
      note: `${m.monthlyBills.items.length} ${m.monthlyBills.items.length === 1 ? 'bill' : 'bills'}`,
      amount: money(m.monthlyBills.total, base),
      color: 'var(--fp-text-3)',
      setAside: false,
    })
  for (const b of m.bigBills) {
    const bill = nameOf('bill', b.billId)
    if (!bill) continue
    lines.push({
      key: `b:${b.billId}:${b.occurrence}`,
      kind: 'bill',
      ownerId: b.billId,
      name: bill.name,
      note: dayMonth(b.occurrence),
      amount: money(b.amountBase, base),
      color: bill.color,
      setAside: false,
    })
  }
  for (const id of m.goalTargets) {
    const goal = goals.find((g) => g.id === id)
    if (!goal) continue
    lines.push({
      key: `t:${id}`,
      kind: 'goal',
      ownerId: id,
      name: goal.name,
      note: 'target',
      amount: goal.target ? money(goal.target, goal.currency) : '',
      color: goal.color,
      setAside: false,
    })
  }
  for (const s of m.setAside.byOwner) {
    const owner = nameOf(s.kind, s.ownerId)
    if (!owner) continue
    lines.push({
      key: `s:${s.kind}:${s.ownerId}`,
      kind: s.kind,
      ownerId: s.ownerId,
      name: owner.name,
      note: 'set aside',
      amount: money(s.amount, base),
      color: s.color,
      setAside: true,
    })
  }
  return lines
}
