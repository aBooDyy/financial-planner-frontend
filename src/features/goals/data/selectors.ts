import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import { convertMinor, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { DEFAULT_DATE_FORMAT, formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import type { GoalFrequency, GoalKind } from '#/features/goals/api/types'
import {
  FREQUENCIES,
  KINDS,
  RECURRING_KINDS,
  STATUS_COLORS,
} from '#/features/goals/constants'
import type { FundingStatus } from '#/features/goals/constants'
import {
  addMonths,
  fmtMonth,
  nextPayday,
  ordinal,
  parseISO,
  relUntil,
  setAsidesLeft,
  simulatePlan,
  ymd,
} from './planning'
import type { PlanTrack, TrackPlan } from './planning'

type RatesMap = Partial<Record<string, number>>

export type IncomeRow = {
  id: string
  label: string
  color: string
  subStr: string
  payStr: string
  monthlyStr: string
  showOriginal: boolean
  originalStr: string
}

export type GoalCard = {
  id: string
  rank: number
  kind: GoalKind
  isObligation: boolean
  name: string
  color: string
  kindLabel: string
  metaStr: string
  // One-line caption for the dense list row: the plain facts when on track, otherwise what's
  // holding it back (queued, catching up, slipping).
  rowMeta: string
  // The monthly set-aside this goal runs at: what you pay now, or — if it's queued behind
  // nearer goals — the rate it will run at once it starts (so the headline is never a bare 0).
  monthlyStr: string
  // Qualifier under the headline, e.g. "from Aug 2026" when funding starts later.
  monthlySubStr: string
  status: FundingStatus
  statusLabel: string
  fundedPct: number
  fundedStr: string
  canUp: boolean
  canDown: boolean
  hasDate: boolean
  dateLabel: string
  dateISO: string
  dateHelper: string
  isOver: boolean
  // Nothing set aside this month — funding starts later. The card mutes the headline figure.
  isDeferred: boolean
  // The full month-by-month set-aside plan, from now until the goal is covered, for the card's
  // expandable timeline. `scheduleSummary` is a one-line teaser; `coverageStr` says when (or
  // whether) it's covered.
  hasSchedule: boolean
  scheduleSummary: string
  coverageStr: string
  scheduleMonths: ScheduleMonth[]
}

export type ScheduleMonth = {
  label: string
  amountStr: string
  // No set-aside this month (a waiting month) — rendered dimmed.
  muted: boolean
  // The month the goal becomes covered — the timeline's end marker.
  covered: boolean
}

// A goal whose target is fully saved — kept for reference, out of the active plan.
export type CompletedGoal = {
  id: string
  kind: GoalKind
  name: string
  color: string
  kindLabel: string
  metaStr: string
}

// One bar in the summary's "Every month" ledger. Every row is measured against the same
// denominator, so the widths compare directly.
export type LedgerRow = {
  key: string
  label: string
  valueStr: string
  pct: number
  color: string
}

// The ledger's closing line: what income is left once every set-aside is taken.
export type LedgerNet = {
  label: string
  valueStr: string
  pct: number
}

export type Suggestion = { text: string; status: FundingStatus }

export type Verdict = {
  status: FundingStatus
  title: string
  sub: string
  suggestTitle: string
  suggestions: Suggestion[]
}

export type TimelineItem = {
  id: string
  dateStr: string
  relStr: string
  name: string
  status: FundingStatus
  hasNote: boolean
  note: string
  last: boolean
}

// One goal's share of a single month's set-aside, in base currency.
export type MonthShare = {
  goalId: string
  name: string
  color: string
  amount: number
  amountStr: string
  // Share of this month's total (0–100) — the stacked bar's segment width.
  pct: number
}

// A month in the aggregate plan: the total set aside and how it splits across goals. Feeds the
// monthly-plan calendar/list on the Goals page.
export type PlanMonth = {
  key: string
  label: string
  monthShort: string
  year: number
  total: number
  totalStr: string
  // No set-aside this month (a waiting month).
  muted: boolean
  shares: MonthShare[]
}

// A block of list rows sharing a funding status, headed by a count and a group note.
export type GoalGroup = {
  status: FundingStatus
  title: string
  note: string
  rows: GoalCard[]
}

// One tab's worth of the plan (goals, or obligations), pre-grouped by status.
export type GoalList = {
  count: number
  subStr: string
  groups: GoalGroup[]
}

// A goal in priority order on the summary, with the share of its plan already in motion.
export type PriorityRow = {
  id: string
  num: string
  name: string
  note: string
  status: FundingStatus
  pct: number
  amountStr: string
}

// A slipping goal the summary surfaces for the user to act on.
export type Decision = {
  goalId: string
  text: string
  action: string
}

// A dated money movement in the coming weeks: a payday, or a goal/obligation coming due.
export type UpcomingEvent = {
  key: string
  dateStr: string
  name: string
  amountStr: string
  incoming: boolean
}

export type PlanSummary = {
  // This month's set-aside as a whole-number share of income (0 when there's no income).
  usagePct: number
  usageStr: string
  ledger: LedgerRow[]
  ledgerNet: LedgerNet
  priority: PriorityRow[]
  priorityNote: string
  decisions: Decision[]
  upcoming: UpcomingEvent[]
}

export type GoalsView = {
  incomeMonthly: number
  totalRequired: number
  leftover: number
  incomeStr: string
  setAsideStr: string
  leftoverStr: string
  leftoverLabel: string
  leftoverIsOver: boolean
  fundedCount: number
  atRiskCount: number
  totalCount: number
  goalsFundedStr: string
  goalsAtRiskStr: string
  horizonStr: string
  asOfStr: string
  incomeRows: IncomeRow[]
  goalCards: GoalCard[]
  goalsList: GoalList
  obligationsList: GoalList
  summary: PlanSummary
  // "SR 15,000 in · SR 13,200 out", the rail's one-line cashflow under the verdict.
  cashflowStr: string
  monthlyPlan: PlanMonth[]
  completedGoals: CompletedGoal[]
  verdict: Verdict
  timeline: TimelineItem[]
  timelineEmpty: boolean
  // Share of everything you're saving toward that's already set aside (saved / target,
  // summed across goals that have a target, in base currency). Null when no goal has a
  // target yet — i.e. nothing to show progress against.
  savedGoalsPct: number | null
}

const EPS = 1

const dueOf = (g: LocalGoal): string | null =>
  g.kind === 'onetime' ? g.dueDate : g.nextDue

/** What's still owed toward the upcoming target/cycle, in base minor units. */
function remainingBase(
  g: LocalGoal,
  base: CurrencyCode,
  rates: RatesMap,
): number {
  if (g.kind === 'openended') return 0
  const target = g.kind === 'onetime' ? (g.target ?? 0) : (g.amount ?? 0)
  return Math.max(
    0,
    convertMinor(target, g.currency, base, rates) -
      convertMinor(g.saved, g.currency, base, rates),
  )
}

/** Translate a goal into the planner's view of it (base minor units, whole months). */
function toTrack(
  g: LocalGoal,
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
): PlanTrack {
  const steady = g.kind === 'openended'
  const recurs = g.kind === 'recurring' || g.kind === 'sinking'
  const perYear = FREQUENCIES[g.frequency ?? 'annual'].perYear
  const cycleAmount = convertMinor(g.amount ?? 0, g.currency, base, rates)
  return {
    id: g.id,
    position: g.position,
    steady,
    monthly: steady ? cycleAmount : 0,
    remaining: remainingBase(g, base, rates),
    deadline: setAsidesLeft(dueOf(g), today),
    recurs,
    cycleMonths: recurs ? Math.max(1, Math.round(12 / perYear)) : 0,
    cycleAmount: recurs ? cycleAmount : 0,
    target: steady ? convertMinor(g.target ?? 0, g.currency, base, rates) : 0,
    saved: steady ? convertMinor(g.saved, g.currency, base, rates) : 0,
  }
}

/** A goal paired with everything the simulation worked out for it. */
type Planned = {
  g: LocalGoal
  track: PlanTrack
  plan: TrackPlan
  status: FundingStatus
}

function statusOf(track: PlanTrack, plan: TrackPlan): FundingStatus {
  if (track.steady) {
    if (plan.fundedNow) return 'green'
    return plan.now > EPS ? 'amber' : 'red'
  }
  if (!plan.meetsDeadline) return 'red'
  return plan.fundedNow ? 'green' : 'amber'
}

export function buildGoalsView(
  income: LocalIncomeStream[],
  goals: LocalGoal[],
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
  // Minor-unit contributions toward each goal (from goal-linked transactions, in the goal's
  // own currency). Folded into each goal's saved progress. Empty by default.
  contributions: Record<string, number> = {},
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
  // Minor-unit sourced allocations toward each goal (wallet or external reserves, in the goal's
  // own currency). Also folded into saved progress. Empty by default.
  allocations: Record<string, number> = {},
): GoalsView {
  const money = (minor: number) => formatMoneyRounded(Math.round(minor), base)
  // A goal's saved progress = its stored baseline + sourced allocations + tx contributions.
  const withContributions = goals.map((g) => ({
    ...g,
    saved: g.saved + (allocations[g.id] ?? 0) + (contributions[g.id] ?? 0),
  }))
  // A goal with a target it has fully met is done — it leaves the active plan (so it stops
  // drawing income) and is shown separately for reference. Recurring/sinking have no target
  // and so never "complete"; they keep recurring.
  const isComplete = (g: LocalGoal) =>
    (g.target ?? 0) > 0 && g.saved >= (g.target ?? 0)
  const activeGoals = withContributions.filter((g) => !isComplete(g))
  const completed = withContributions.filter(isComplete)
  const ordered = [...activeGoals].sort((a, b) => a.position - b.position)

  // --- Income, normalized to a monthly base figure ---
  const incomeMonthlyOf = (s: LocalIncomeStream): number =>
    (convertMinor(s.amount, s.currency, base, rates) *
      FREQUENCIES[s.frequency].perYear) /
    12
  const incomeMonthly = income.reduce((a, s) => a + incomeMonthlyOf(s), 0)

  const incomeRows: IncomeRow[] = income.map((s) => {
    const monthly = incomeMonthlyOf(s)
    const showOriginal = s.currency !== base || s.frequency !== 'monthly'
    const pay = nextPayday(s.day, today)
    return {
      id: s.id,
      label: s.label,
      color: s.color,
      subStr: `${formatMoneyRounded(s.amount, s.currency)} ${FREQUENCIES[s.frequency].every}`,
      payStr: `Paid the ${ordinal(s.day)} · next ${formatDate(pay, dateFormat)}`,
      monthlyStr: money(monthly),
      showOriginal,
      originalStr: `${formatMoneyRounded(s.amount, s.currency)}${FREQUENCIES[s.frequency].short}`,
    }
  })

  // --- Time-phased funding (earliest-deadline-first, priority breaks ties) ---
  const tracks = ordered.map((g) => toTrack(g, base, rates, today))
  const horizon = planHorizon(tracks)
  const plans = new Map(
    simulatePlan(tracks, incomeMonthly, horizon).map((p) => [p.id, p]),
  )
  const planned: Planned[] = ordered.map((g, i) => {
    const track = tracks[i]
    const plan = plans.get(g.id) as TrackPlan
    return { g, track, plan, status: statusOf(track, plan) }
  })

  const totalNow = planned.reduce((a, p) => a + p.plan.now, 0)
  const leftover = Math.max(0, incomeMonthly - totalNow)
  const greenCount = planned.filter((p) => p.status === 'green').length
  const amberCount = planned.filter((p) => p.status === 'amber').length
  const redCount = planned.filter((p) => p.status === 'red').length

  const goalCards: GoalCard[] = planned.map((p, idx) => {
    const { g, plan, status } = p
    const hasDate = g.kind !== 'openended'
    const isDeferred = status === 'amber' && plan.startsIn > 0
    // Headline the rate you actually pay: this month's set-aside, or — when nothing is set
    // aside yet — the rate it ramps to, so the figure is never a bare SR 0.
    const headline = plan.now > EPS ? plan.now : plan.peak
    const covered = new Set(plan.completions)
    const scheduleMonths: ScheduleMonth[] = plan.schedule.map((amt, i) => {
      const r = Math.round(amt)
      return {
        label: monthLabel(today, i),
        amountStr: money(r),
        muted: r <= 0,
        covered: covered.has(i),
      }
    })
    return {
      id: g.id,
      rank: idx + 1,
      kind: g.kind,
      isObligation: isObligationKind(g.kind),
      name: g.name,
      color: g.color,
      kindLabel: KINDS[g.kind].chip,
      metaStr: metaFor(g),
      rowMeta: rowMetaFor(p, today, money),
      monthlyStr: money(headline),
      monthlySubStr:
        plan.startsIn > 0 && status !== 'green'
          ? `from ${fmtMonth(addMonths(today, plan.startsIn))}`
          : '',
      status,
      statusLabel: statusLabel(g.kind, status),
      fundedPct: progressPct(g),
      fundedStr: `${Math.round(progressPct(g))}%`,
      canUp: idx > 0,
      canDown: idx < planned.length - 1,
      hasDate,
      dateLabel: g.kind === 'onetime' ? 'Deadline' : 'Next due',
      dateISO: hasDate && dueOf(g) ? ymd(parseISO(dueOf(g), today)) : '',
      dateHelper: helperFor(p, today, money),
      isOver: status === 'red',
      isDeferred,
      hasSchedule: scheduleMonths.length > 0,
      scheduleSummary: scheduleSummaryOf(plan, today, money),
      coverageStr: coverageLabel(p, today),
      scheduleMonths,
    }
  })

  // --- Month-by-month allocation across all goals (the monthly-plan calendar/list) ---
  const horizonLen = planned.reduce(
    (mx, p) => Math.max(mx, p.plan.schedule.length),
    0,
  )
  const monthlyPlan: PlanMonth[] = []
  for (let m = 0; m < horizonLen; m++) {
    const d = addMonths(today, m)
    const shares = planned
      .map((p) => ({ p, amount: Math.round(p.plan.schedule[m] ?? 0) }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    const total = shares.reduce((a, s) => a + s.amount, 0)
    monthlyPlan.push({
      key: `m${m}`,
      label: fmtMonth(d),
      monthShort: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      total,
      totalStr: money(total),
      muted: total <= 0,
      shares: shares.map((s) => ({
        goalId: s.p.g.id,
        name: s.p.g.name,
        color: s.p.g.color,
        amount: s.amount,
        amountStr: money(s.amount),
        pct: total > 0 ? (s.amount / total) * 100 : 0,
      })),
    })
  }

  // --- Completed goals (reference only, out of the plan) ---
  const completedGoals: CompletedGoal[] = [...completed]
    .sort((a, b) => a.position - b.position)
    .map((g) => {
      const own = (minor: number) => formatMoneyRounded(minor, g.currency)
      return {
        id: g.id,
        kind: g.kind,
        name: g.name,
        color: g.color,
        kindLabel: KINDS[g.kind].chip,
        metaStr: `Saved ${own(g.saved)} of ${own(g.target ?? 0)}`,
      }
    })

  // --- Goals / obligations tabs + the summary section ---
  const pairs = planned.map((p, i) => ({ p, card: goalCards[i] }))
  const goalPairs = pairs.filter((x) => !x.card.isObligation)
  const obligationPairs = pairs.filter((x) => x.card.isObligation)
  const goalsList = buildList(
    goalPairs,
    money,
    (n, totalStr) => `${n} ${n === 1 ? 'goal' : 'goals'} · ${totalStr}/mo`,
  )
  const obligationsList = buildList(
    obligationPairs,
    money,
    (n, totalStr) =>
      `${n} recurring ${n === 1 ? 'commitment' : 'commitments'} · ${totalStr}/mo`,
  )
  // Every ledger bar shares this denominator, so income and what it has to cover compare
  // directly on one scale.
  const denom = Math.max(incomeMonthly, totalNow, 1)
  const pctOf = (v: number) => (v / denom) * 100
  const obligationsNow = sumNow(obligationPairs.map((x) => x.p))
  const goalsNow = sumNow(goalPairs.map((x) => x.p))
  const summary: PlanSummary = {
    usagePct:
      incomeMonthly > 0 ? Math.round((totalNow / incomeMonthly) * 100) : 0,
    usageStr:
      incomeMonthly > 0
        ? `${Math.round((totalNow / incomeMonthly) * 100)}% of income committed`
        : 'no income yet',
    ledger: [
      {
        key: 'income',
        label: 'Income',
        valueStr: money(incomeMonthly),
        pct: pctOf(incomeMonthly),
        color: 'var(--fp-accent)',
      },
      {
        key: 'obligations',
        label: 'Obligations',
        valueStr: money(obligationsNow),
        pct: pctOf(obligationsNow),
        color: '#64748B',
      },
      {
        key: 'goals',
        label: 'Goals',
        valueStr: money(goalsNow),
        pct: pctOf(goalsNow),
        color: '#EC4899',
      },
    ],
    ledgerNet: {
      label: 'Left over',
      valueStr: `${money(leftover)} spare`,
      pct: pctOf(leftover),
    },
    priority: goalCards.map((card) => ({
      id: card.id,
      num: String(card.rank),
      name: card.name,
      note: priorityNoteFor(card),
      status: card.status,
      pct: card.status === 'green' ? 100 : card.isOver ? 0 : card.fundedPct,
      amountStr: card.monthlyStr,
    })),
    priorityNote:
      greenCount === goalCards.length
        ? `all ${goalCards.length} on track`
        : `${greenCount} of ${goalCards.length} on track`,
    decisions: planned
      .filter((p) => p.status === 'red')
      .slice(0, 4)
      .map((p) => decisionFor(p, today, money)),
    upcoming: buildUpcoming(income, ordered, base, rates, today, money),
  }

  // --- Verdict + suggestions ---
  const verdict = buildVerdict(
    planned,
    incomeMonthly,
    leftover,
    base,
    rates,
    money,
  )

  // --- Completion timeline ---
  const timeline = buildTimeline(planned, today)

  // --- Overall saved-toward-target progress (Balances baseline teaser) ---
  let savedSum = 0
  let targetSum = 0
  for (const g of withContributions) {
    const target = g.target ?? 0
    if (target <= 0) continue
    const targetBase = convertMinor(target, g.currency, base, rates)
    const savedBase = convertMinor(g.saved, g.currency, base, rates)
    savedSum += Math.min(savedBase, targetBase)
    targetSum += targetBase
  }
  const savedGoalsPct = targetSum > 0 ? savedSum / targetSum : null

  return {
    incomeMonthly,
    totalRequired: totalNow,
    leftover,
    incomeStr: money(incomeMonthly),
    setAsideStr: money(totalNow),
    leftoverStr: money(leftover),
    leftoverLabel: 'Left over',
    leftoverIsOver: false,
    fundedCount: greenCount,
    atRiskCount: amberCount + redCount,
    totalCount: activeGoals.length,
    goalsFundedStr: `${greenCount} on track`,
    goalsAtRiskStr:
      redCount > 0
        ? `${redCount} slipping`
        : amberCount > 0
          ? `${amberCount} scheduled`
          : '0 at risk',
    horizonStr: `${activeGoals.length} total`,
    asOfStr: `As of ${formatDate(today, dateFormat)}`,
    incomeRows,
    goalCards,
    goalsList,
    obligationsList,
    summary,
    cashflowStr: `${money(incomeMonthly)} in · ${money(totalNow)} out`,
    monthlyPlan,
    completedGoals,
    verdict,
    timeline,
    timelineEmpty: timeline.length === 0,
    savedGoalsPct,
  }
}

/** How far ahead to simulate: past the furthest deadline (and any open-ended target run). */
function planHorizon(tracks: PlanTrack[]): number {
  let max = 12
  for (const t of tracks) {
    if (t.steady) {
      if (t.target > EPS && t.monthly > EPS)
        max = Math.max(max, Math.ceil(t.target / t.monthly))
    } else {
      max = Math.max(max, t.deadline)
    }
  }
  return Math.min(600, max + 2)
}

/** Progress toward the goal's objective (saved vs. target, or this cycle), 0–100. */
function progressPct(g: LocalGoal): number {
  const denom =
    g.kind === 'onetime' || g.kind === 'openended'
      ? (g.target ?? 0)
      : (g.amount ?? 0)
  if (denom <= 0) return g.saved > 0 ? 100 : 0
  return Math.max(0, Math.min(100, (g.saved / denom) * 100))
}

function statusLabel(kind: GoalKind, status: FundingStatus): string {
  if (status === 'green') return 'On track'
  if (status === 'red')
    return kind === 'openended' ? 'Unfunded' : 'Won’t make it'
  return 'Scheduled'
}

function helperFor(
  p: Planned,
  today: Date,
  money: (n: number) => string,
): string {
  const { track, plan, status } = p
  if (track.steady) {
    if (status === 'green') return 'Funded every month'
    if (status === 'amber') return `Partly funded now → ${money(plan.peak)}/mo`
    return 'No income left this month'
  }
  const by = fmtMonth(addMonths(today, track.deadline))
  if (status === 'red') return `Won’t finish by ${by}`
  if (status === 'amber') {
    return plan.startsIn > 0
      ? `Starts in ${plan.startsIn} ${plan.startsIn === 1 ? 'mo' : 'mos'} → ${money(plan.peak)}/mo`
      : `Catching up → ${money(plan.peak)}/mo`
  }
  return `${track.deadline} ${track.deadline === 1 ? 'mo' : 'mos'} left · on track`
}

const isObligationKind = (kind: GoalKind): boolean =>
  RECURRING_KINDS.includes(kind)

const sumNow = (items: Planned[]): number =>
  items.reduce((a, p) => a + p.plan.now, 0)

/** The one line a priority row adds under the name: why it isn't simply on track. */
function priorityNoteFor(card: GoalCard): string {
  if (card.status === 'green') return ''
  if (card.isOver) return card.statusLabel
  return card.monthlySubStr
    ? `${card.statusLabel} · ${card.monthlySubStr}`
    : card.statusLabel
}

/** "Jul 1", a day within the next few months. */
const fmtDay = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric' })

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/** The list row's caption: the plain facts when on track, else the funding helper. */
function rowMetaFor(
  p: Planned,
  today: Date,
  money: (n: number) => string,
): string {
  const { g, status } = p
  if (status !== 'green') return helperFor(p, today, money)
  const chip = KINDS[g.kind].chip
  const pct = Math.round(progressPct(g))
  if (g.kind === 'onetime')
    return `${chip} · ${pct}% saved · ${fmtMonth(parseISO(g.dueDate, today))}`
  if (g.kind === 'openended')
    return (g.target ?? 0) > 0
      ? `${chip} · ${pct}% of target`
      : `${chip} · no deadline`
  const every = FREQUENCIES[g.frequency ?? 'annual'].every
  return `${chip} · ${every} · ${fmtDay(parseISO(g.nextDue, today))}`
}

const GROUP_TITLES: Record<FundingStatus, string> = {
  green: 'On track',
  amber: 'Scheduled',
  red: 'Won’t make it',
}

function groupNote(
  status: FundingStatus,
  members: Planned[],
  money: (n: number) => string,
): string {
  if (status === 'green') return `${money(sumNow(members))}/mo`
  if (status === 'amber') return 'still on time · funded later'
  const short = members.reduce((a, p) => a + shortfallOf(p), 0)
  return `about ${money(short)}/mo short`
}

function buildList(
  items: { p: Planned; card: GoalCard }[],
  money: (n: number) => string,
  subOf: (count: number, totalStr: string) => string,
): GoalList {
  const statuses: FundingStatus[] = ['green', 'amber', 'red']
  const groups = statuses
    .map((status) => {
      const members = items.filter((x) => x.p.status === status)
      return {
        status,
        title: `${GROUP_TITLES[status]} · ${members.length}`,
        note: groupNote(
          status,
          members.map((x) => x.p),
          money,
        ),
        rows: members.map((x) => x.card),
      }
    })
    .filter((group) => group.rows.length > 0)
  return {
    count: items.length,
    subStr: subOf(items.length, money(sumNow(items.map((x) => x.p)))),
    groups,
  }
}

function decisionFor(
  p: Planned,
  today: Date,
  money: (n: number) => string,
): Decision {
  return {
    goalId: p.g.id,
    text: `${p.g.name} — ${lowerFirst(helperFor(p, today, money))}`,
    action: p.g.kind === 'onetime' ? 'Push out' : 'Adjust',
  }
}

const UPCOMING_DAYS = 60
const UPCOMING_MAX = 6
const DAY_MS = 86_400_000

/** Every occurrence of a (possibly repeating) date from today through the upcoming window. */
function occurrencesWithin(
  first: Date,
  frequency: GoalFrequency | null,
  today: Date,
): Date[] {
  const limit = today.getTime() + UPCOMING_DAYS * DAY_MS
  const at = (n: number): Date => {
    if (!frequency) return first
    if (frequency === 'weekly')
      return new Date(
        first.getFullYear(),
        first.getMonth(),
        first.getDate() + 7 * n,
      )
    const step = Math.max(1, Math.round(12 / FREQUENCIES[frequency].perYear))
    return addMonths(first, n * step)
  }
  const out: Date[] = []
  for (let n = 0; n < 12; n++) {
    const d = at(n)
    if (d.getTime() > limit) break
    if (d.getTime() >= today.getTime()) out.push(d)
    if (!frequency) break
  }
  return out
}

/** Paydays and due dates in the next 60 days, soonest first. */
function buildUpcoming(
  income: LocalIncomeStream[],
  goals: LocalGoal[],
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
  money: (n: number) => string,
): UpcomingEvent[] {
  const events: { at: Date; event: UpcomingEvent }[] = []
  for (const s of income) {
    const amountStr = `+${money(convertMinor(s.amount, s.currency, base, rates))}`
    occurrencesWithin(nextPayday(s.day, today), s.frequency, today).forEach(
      (at, n) =>
        events.push({
          at,
          event: {
            key: `${s.id}:${n}`,
            dateStr: fmtDay(at),
            name: `${s.label} in`,
            amountStr,
            incoming: true,
          },
        }),
    )
  }
  for (const g of goals) {
    const due = dueOf(g)
    if (!due) continue
    const amount = g.kind === 'onetime' ? (g.target ?? 0) : (g.amount ?? 0)
    const amountStr = money(convertMinor(amount, g.currency, base, rates))
    const frequency = g.kind === 'onetime' ? null : (g.frequency ?? 'annual')
    occurrencesWithin(parseISO(due, today), frequency, today).forEach((at, n) =>
      events.push({
        at,
        event: {
          key: `${g.id}:${n}`,
          dateStr: fmtDay(at),
          name: g.name,
          amountStr,
          incoming: false,
        },
      }),
    )
  }
  return events
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, UPCOMING_MAX)
    .map((x) => x.event)
}

/** Month label `n` months from today, e.g. "Aug 2026". */
function monthLabel(today: Date, n: number): string {
  return fmtMonth(addMonths(today, n))
}

/**
 * Compact teaser for the collapsed plan — the gist of the month-by-month path in one line, e.g.
 * "SR 0 until Aug 2026 → SR 300/mo" (or "SR 450 → SR 0/mo" when funding tapers). The expandable
 * timeline carries the per-month detail.
 */
function scheduleSummaryOf(
  plan: TrackPlan,
  today: Date,
  money: (n: number) => string,
): string {
  const path = plan.schedule
  if (path.length === 0) return ''

  const runs: { start: number; amt: number }[] = []
  for (let i = 0; i < path.length; ) {
    const amt = Math.round(path[i])
    let j = i
    while (j + 1 < path.length && Math.round(path[j + 1]) === amt) j++
    runs.push({ start: i, amt })
    i = j + 1
  }

  const paying = runs.filter((r) => r.amt > 0)
  if (paying.length === 0) return `${money(0)}/mo`
  const first = paying[0]
  const last = paying[paying.length - 1]
  const lead =
    first.start > 0
      ? `${money(0)} until ${monthLabel(today, first.start)} → `
      : ''
  const rate =
    last.amt !== first.amt
      ? `${money(first.amt)} → ${money(last.amt)}/mo`
      : `${money(first.amt)}/mo`
  return `${lead}${rate}`
}

/** Caption telling the user when — or whether — the goal is covered. */
function coverageLabel(p: Planned, today: Date): string {
  const { g, track, plan } = p
  if (plan.completesIn !== null) {
    const month = monthLabel(today, plan.completesIn)
    if (g.kind === 'recurring' || g.kind === 'sinking')
      return `Due ${month} · repeats ${FREQUENCIES[g.frequency ?? 'annual'].every}`
    if (g.kind === 'openended') return `Target reached ${month}`
    return `Covered ${month}`
  }
  if (g.kind === 'openended') return 'Ongoing — no end date'
  return `Not covered by ${monthLabel(today, track.deadline)}`
}

function metaFor(g: LocalGoal): string {
  const own = (minor: number) => formatMoneyRounded(minor, g.currency)
  if (g.kind === 'onetime') {
    const rem = Math.max(0, (g.target ?? 0) - g.saved)
    return `Target ${own(g.target ?? 0)} · ${own(g.saved)} saved · ${own(rem)} to go`
  }
  if (g.kind === 'openended') {
    return g.target
      ? `Target ${own(g.target)} · ${own(g.saved)} saved · no deadline`
      : `${own(g.amount ?? 0)}/mo · no deadline`
  }
  const every = FREQUENCIES[g.frequency ?? 'annual'].every
  return `${own(g.amount ?? 0)} ${every}${g.saved > 0 ? ` · ${own(g.saved)} saved` : ''}`
}

/** Extra income/month that would close a missed deadline (approximate). */
function shortfallOf(p: Planned): number {
  if (p.status !== 'red') return 0
  if (p.track.steady) return Math.max(0, p.track.monthly - p.plan.now)
  return p.track.remaining / Math.max(1, p.track.deadline)
}

function buildVerdict(
  planned: Planned[],
  incomeMonthly: number,
  leftover: number,
  base: CurrencyCode,
  rates: RatesMap,
  money: (n: number) => string,
): Verdict {
  const slipping = planned.filter((p) => p.status === 'red')
  const ratio = incomeMonthly > 0 ? leftover / incomeMonthly : -1
  let status: FundingStatus
  let title: string
  let sub: string
  if (slipping.length > 0) {
    const shortfall = slipping.reduce((a, p) => a + shortfallOf(p), 0)
    status = 'red'
    title = 'Some goals will slip'
    sub = `${slipping.length} ${slipping.length === 1 ? 'goal' : 'goals'} won’t be met on time — about ${money(shortfall)}/mo short.`
  } else if (ratio < 0.08) {
    status = 'amber'
    title = 'Tight but on track'
    sub = `Every deadline is covered, with ${money(Math.max(0, leftover))}/mo to spare.`
  } else {
    status = 'green'
    title = 'On track'
    sub = `Every goal is funded on schedule, with ${money(leftover)}/mo to spare.`
  }

  let suggestions: Suggestion[]
  if (status === 'green') {
    suggestions = [
      {
        text: 'You have room — raise a fund, pull a deadline in, or add a new goal.',
        status,
      },
    ]
  } else {
    suggestions = planned
      .filter((p) => p.status !== 'green')
      .slice(0, 3)
      .map((p) => ({
        text: suggestionFor(p, base, rates, money),
        status: p.status,
      }))
  }

  return {
    status,
    title,
    sub,
    suggestTitle:
      status === 'green' ? 'Room to grow' : 'How to get back on track',
    suggestions,
  }
}

function suggestionFor(
  p: Planned,
  base: CurrencyCode,
  rates: RatesMap,
  money: (n: number) => string,
): string {
  const { g, track, plan, status } = p
  if (status === 'amber') {
    return plan.startsIn > 0
      ? `“${g.name}” is queued — funding starts in ${plan.startsIn} ${plan.startsIn === 1 ? 'mo' : 'mos'} once nearer goals are paid.`
      : `“${g.name}” is catching up — it climbs to ${money(plan.peak)}/mo.`
  }
  if (g.kind === 'onetime') {
    const newM = remainingBase(g, base, rates) / (track.deadline + 12)
    return `Push “${g.name}” out a year → ${money(newM)}/mo instead of slipping.`
  }
  if (g.kind === 'openended') {
    return `Lower or pause “${g.name}” until income recovers.`
  }
  return `Trim or re-time “${g.name}” — it can’t be funded by its due date.`
}

/**
 * The forward coverage forecast: every point a goal or obligation is covered, in order, up to the
 * latest goal's date. A one-time / target goal contributes a single completion; a recurring
 * obligation contributes one per cycle (covered, then due again), so the list reads as a real
 * month-by-month payments timeline rather than just final completions.
 */
function buildTimeline(planned: Planned[], today: Date): TimelineItem[] {
  type Milestone = {
    id: string
    date: Date | null
    name: string
    status: FundingStatus
    slipped: boolean
    target: Date | null
  }
  // The global horizon (the latest goal's coverage) — recurring schedules already run to here.
  const horizonM = planned.reduce(
    (mx, p) => Math.max(mx, p.plan.schedule.length - 1),
    0,
  )
  const milestones: Milestone[] = []
  for (const p of planned) {
    const { g, track, plan, status } = p
    const finishes =
      g.kind === 'onetime' || (g.kind === 'openended' && (g.target ?? 0) > 0)
    // Obligations that recur monthly (or weekly) would flood the timeline with a row every
    // month — they're left off it (their per-card plan still shows them in full).
    const recurring =
      (g.kind === 'recurring' || g.kind === 'sinking') && track.cycleMonths > 1
    if (!finishes && !recurring) continue

    if (plan.completions.length === 0) {
      // Never covered within the horizon — surface where it stalls / falls short of its deadline.
      const slipped = g.kind === 'onetime'
      milestones.push({
        id: g.id,
        date: track.deadline > 0 ? addMonths(today, track.deadline) : null,
        name: g.name,
        status,
        slipped,
        target: slipped ? parseISO(g.dueDate, today) : null,
      })
      continue
    }

    // A finishing goal is covered once; a recurring obligation, once per cycle up to the horizon.
    const months = finishes ? plan.completions.slice(0, 1) : plan.completions
    for (const c of months) {
      if (c > horizonM) continue
      const slipped = g.kind === 'onetime' && !plan.meetsDeadline
      milestones.push({
        id: `${g.id}:${c}`,
        date: addMonths(today, c + 1),
        name: g.name,
        status,
        slipped,
        target: slipped ? parseISO(g.dueDate, today) : null,
      })
    }
  }
  milestones.sort(
    (a, b) =>
      (a.date ? a.date.getTime() : 9e15) - (b.date ? b.date.getTime() : 9e15),
  )
  return milestones.map((ms, i) => ({
    id: ms.id,
    dateStr: ms.date ? fmtMonth(ms.date) : 'Stalled',
    relStr: ms.date ? relUntil(ymd(ms.date), today) : 'unfunded',
    name: ms.name,
    status: ms.status,
    hasNote: ms.slipped && ms.date != null,
    note:
      ms.slipped && ms.date && ms.target
        ? `planned ${fmtMonth(ms.target)} — slips at this pace`
        : '',
    last: i === milestones.length - 1,
  }))
}

export { STATUS_COLORS }
