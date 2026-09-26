/**
 * The goal detail read view (1a) — header, two-segment progress, stored-vs-live plan box with
 * its band, and the contributions list — derived from the planner's `GoalPlanView`. Pure: the
 * components render these strings and compute nothing.
 */
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { KINDS } from '#/features/goals/constants'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import type {
  ContributionEntry,
  ContributionRun,
  GoalPlanView,
  PlanHeader,
} from '#/features/planned'
import { decimalsFor, formatMoney, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { parseISODate } from '#/lib/date'

/** Only what the view needs from a plan rewrite (a Recalculate or a plan-changing edit). */
export type RecalcSummary = {
  at: string
  before: {
    plannedAt: string | null
    planAmount: number | null
    planCount: number | null
  }
  header: PlanHeader
}

export type PlanCell = {
  label: string
  amountStr: string
  /** "/mo", or a bill's own cadence when the plan is its payments. */
  unit: string
  sub: string
}

export type DetailBand =
  | { kind: 'updated'; lead: string; text: string }
  | {
      kind: 'behind'
      title: string
      text: string
      recalcLabel: string | null
      confirmLabel: string | null
      confirmId: string | null
    }
  | { kind: 'ahead'; title: string; recalcLabel: string | null }
  | { kind: 'off'; text: string }

export type ContributionMark = 'confirmed' | 'due' | 'future' | 'skipped'

export type ContributionRowView = {
  key: string
  mark: ContributionMark
  dateStr: string
  caption: string
  amountStr: string
  /** A planned row the user can confirm (due, or early). */
  plannedId: string | null
  /** A set-aside the user can take back. */
  allocationId: string | null
}

export type GoalDetailView = {
  subtitle: string
  /** Null when the goal has nothing to measure against (a fund with no target). */
  pctStr: string | null
  bar: { savedPct: number; awaitingPct: number } | null
  savedCaption: string
  leftCaption: string
  plan: {
    left: PlanCell | null
    right: PlanCell
    /** Right after a rewrite: the new plan is the one to look at. */
    highlightRight: boolean
  } | null
  band: DetailBand | null
  contributions: ContributionRowView[]
  /** How many of the oldest rows start hidden behind "Show earlier". */
  earlierCount: number
  /** 1b's sub line: "SR 9,000 left · next planned Oct 1". */
  addSub: string
}

/** Confirmed rows kept in view before the older ones fold behind "Show earlier". */
export const RECENT_CONFIRMED = 5

/** "Sep 1". */
export const monthDay = (iso: string): string =>
  (parseISODate(iso) ?? new Date(NaN)).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
  })

const monthOnly = (iso: string): string =>
  (parseISODate(iso) ?? new Date(NaN)).toLocaleString('en-US', {
    month: 'short',
  })

const fullDate = (iso: string): string =>
  (parseISODate(iso) ?? new Date(NaN)).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/** Whole amounts read as "SR 1,500"; anything with minor units keeps them. */
export const tidyMoney = (minor: number, currency: CurrencyCode): string =>
  minor % 10 ** decimalsFor(currency) === 0
    ? formatMoneyRounded(minor, currency)
    : formatMoney(minor, currency)

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? '' : 's'}`

const isPaymentKind = (goal: LocalGoal): boolean => goal.kind === 'recurring'

function subtitleOf(goal: LocalGoal): string {
  const money = (minor: number) => tidyMoney(minor, goal.currency)
  const chip = KINDS[goal.kind].chip
  switch (goal.kind) {
    case 'onetime':
      return goal.dueDate
        ? `${chip} · ${money(goal.target ?? 0)} by ${fullDate(goal.dueDate)}`
        : `${chip} · ${money(goal.target ?? 0)}`
    case 'openended':
      return goal.target
        ? `${chip} · ${money(goal.target)} target`
        : `${chip} · ${money(goal.amount ?? 0)}/mo`
    default:
      return goal.nextDue
        ? `${chip} · ${money(goal.amount ?? 0)} due ${monthDay(goal.nextDue)}`
        : `${chip} · ${money(goal.amount ?? 0)}`
  }
}

function cellOf(
  label: string,
  amount: number,
  count: number,
  goal: LocalGoal,
): PlanCell {
  const cadence = frequencyMetaOf(goal, 'monthly').short
  return {
    label,
    amountStr: tidyMoney(amount, goal.currency),
    unit: count > 0 ? '/mo' : cadence,
    sub:
      count > 0
        ? `× ${plural(count, 'set-aside')}`
        : amount > 0
          ? 'paid when due'
          : 'nothing left to plan',
  }
}

function updatedBand(recalc: RecalcSummary, goal: LocalGoal): DetailBand {
  const { header } = recalc
  const amount = tidyMoney(header.amount, goal.currency)
  let text = "Future planned items now follow today's numbers."
  if (header.count === 1 && header.start)
    text = `The ${monthOnly(header.start)} planned set-aside is now ${amount}.`
  else if (header.count > 1 && header.start && header.end)
    text = `${monthOnly(header.start)}–${monthOnly(header.end)} planned set-asides now ${amount} each.`
  return {
    kind: 'updated',
    lead: `Plan updated ${monthDay(recalc.at)}.`,
    text,
  }
}

function behindText(plan: GoalPlanView, goal: LocalGoal): string {
  const { behind, stored } = plan
  const noun = (item: LocalPlanned | undefined) =>
    item?.role === 'payment' ? 'payment' : 'set-aside'
  const money = (minor: number, currency: CurrencyCode) =>
    tidyMoney(minor, currency)

  if (behind.reason === 'skipped') {
    const first = behind.skipped[0]
    const lead =
      behind.skipped.length === 1
        ? `You skipped ${monthOnly(first.date)}'s ${money(first.amount, first.currency)}.`
        : `You skipped ${plural(behind.skipped.length, `planned ${noun(first)}`)}.`
    return `${lead} Spread the gap over the months left, or add a contribution.`
  }

  const open = behind.unconfirmed
  const first = open[0] as LocalPlanned | undefined
  const lead =
    open.length <= 1
      ? `The ${first ? monthDay(first.date) : ''} ${noun(first)} hasn't been confirmed.`
      : `${plural(open.length, `planned ${noun(first)}`)} haven't been confirmed.`
  const stay = stored
    ? ` Confirm ${open.length > 1 ? 'them' : 'it'} to stay on ${money(stored.amount, goal.currency)}/mo, or spread the gap over the months left.`
    : ''
  return `${lead}${stay}`
}

function bandOf(
  plan: GoalPlanView,
  goal: LocalGoal,
  recalc: RecalcSummary | null,
  unit: string,
): DetailBand | null {
  if (recalc) return updatedBand(recalc, goal)
  const money = (minor: number) => tidyMoney(minor, goal.currency)
  const recalcLabel = plan.isOffPlan
    ? plan.live.amount > 0
      ? `Recalculate to ${money(plan.live.amount)}`
      : 'Recalculate'
    : null

  if (plan.behind.kind === 'behind') {
    const due = plan.behind.oldestDue
    return {
      kind: 'behind',
      title: `${money(plan.behind.behind)} behind plan`,
      text: behindText(plan, goal),
      recalcLabel,
      confirmLabel: due ? `Confirm ${monthOnly(due.date)}` : null,
      confirmId: due?.id ?? null,
    }
  }
  if (plan.behind.kind === 'ahead')
    return {
      kind: 'ahead',
      title: `${money(-plan.behind.behind)} ahead of plan`,
      recalcLabel,
    }
  if (plan.isOffPlan)
    return {
      kind: 'off',
      text: `Plan is ${money(Math.abs(plan.offBy))}${unit} off from today's numbers`,
    }
  return null
}

function rowOf(
  item: ContributionEntry | ContributionRun,
  currency: CurrencyCode,
): ContributionRowView {
  if ('entries' in item)
    return {
      key: item.key,
      mark: 'future',
      dateStr: `${monthDay(item.from)} – ${monthDay(item.to)}`,
      caption: `Planned · ${item.count} more`,
      amountStr: `${tidyMoney(item.amount, currency)} each`,
      plannedId: null,
      allocationId: null,
    }
  return {
    key: item.key,
    mark: item.state,
    dateStr: monthDay(item.date),
    caption: item.caption,
    amountStr: tidyMoney(item.amount, currency),
    plannedId:
      item.source === 'planned' &&
      (item.state === 'due' || item.state === 'future')
        ? item.plannedId
        : null,
    allocationId: item.source === 'allocation' ? item.settlementId : null,
  }
}

export function buildGoalDetail(
  goal: LocalGoal,
  plan: GoalPlanView,
  recalc: RecalcSummary | null,
  collapsed: ReadonlyArray<ContributionEntry | ContributionRun>,
): GoalDetailView {
  const money = (minor: number) => tidyMoney(minor, goal.currency)
  const { saved, awaiting, target, left } = plan.progress
  const paying = isPaymentKind(goal)

  const savedPct = target > 0 ? Math.min(100, (saved / target) * 100) : 0
  const awaitingPct =
    target > 0 ? Math.min(100 - savedPct, (awaiting / target) * 100) : 0

  const right = cellOf('From today', plan.live.amount, plan.live.count, goal)
  const previous = recalc
    ? recalc.before.plannedAt
      ? cellOf(
          'Previous plan',
          recalc.before.planAmount ?? 0,
          recalc.before.planCount ?? 0,
          goal,
        )
      : null
    : plan.stored
      ? cellOf(
          `Saved plan · ${monthDay(plan.stored.plannedAt)}`,
          plan.stored.amount,
          plan.stored.count,
          goal,
        )
      : null
  const hasPlan =
    recalc !== null || plan.live.amount > 0 || (plan.stored?.amount ?? 0) > 0

  const rows = collapsed.map((c) => rowOf(c, goal.currency))
  const confirmedIdx = rows
    .map((r, i) => (r.mark === 'confirmed' ? i : -1))
    .filter((i) => i >= 0)
  const earlierCount =
    confirmedIdx.length > RECENT_CONFIRMED
      ? confirmedIdx[confirmedIdx.length - RECENT_CONFIRMED]
      : 0

  const next = plan.nextPlanned
  const addSub = [
    target > 0 ? `${money(left)} left` : `${money(saved)} saved`,
    next ? `next planned ${monthDay(next.date)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    subtitle: subtitleOf(goal),
    pctStr: target > 0 ? `${Math.round((saved / target) * 100)}%` : null,
    bar: target > 0 ? { savedPct, awaitingPct } : null,
    savedCaption: [
      `${money(saved)} ${paying ? 'paid this cycle' : 'saved'}`,
      awaiting > 0 ? `${money(awaiting)} awaiting confirm` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    leftCaption: target > 0 ? `${money(left)} left` : '',
    plan: hasPlan
      ? { left: previous, right, highlightRight: recalc !== null }
      : null,
    band: bandOf(plan, goal, recalc, right.unit),
    contributions: rows,
    earlierCount,
    addSub,
  }
}

/** Goals with planned items waiting on a confirm — the list rows' "N to confirm". */
export function dueCountByGoal(
  planned: ReadonlyArray<LocalPlanned>,
  today: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of planned) {
    if (p.deleted !== 0 || p.status !== 'open' || !p.goalId) continue
    if (p.date > today) continue
    out[p.goalId] = (out[p.goalId] ?? 0) + 1
  }
  return out
}
