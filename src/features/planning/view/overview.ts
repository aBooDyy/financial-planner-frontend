/**
 * Overview's copy and shapes (04 §5, D27): the verdict in the docs' words, the Each paycheck
 * bar's parts, the Next 30 days events and the Needs a decision lines. Pure.
 */
import type { LocalBill, LocalGoal } from '#/db/types'
import { addDaysISO, daysBetween } from '#/features/planned/data/dates'
import type {
  Decision,
  EachPaycheck,
  Verdict,
} from '#/features/planning/data/paycheck'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type {
  UpcomingRow,
  UpcomingView,
} from '#/features/planning/data/upcoming'
import type { PlanningSection } from '#/features/planning/sections'
import type { CurrencyCode } from '#/lib/currency'
import {
  dayMonth,
  money,
  monthYear,
  ordinal,
  perPeriod,
  plural,
} from './format'
import { repeatLabel } from './repeat'

export type VerdictCopy = {
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
  title: string
  sub: string
  action: { label: string; primary: boolean; to: VerdictAction }
}

export type VerdictAction =
  | 'upcoming'
  | 'chooser'
  | 'income'
  | { kind: 'bill' | 'goal'; id: string }

export function verdictCopy(args: {
  verdict: Verdict
  decision: Decision | null
  /** The decision's bill or goal: its name and currency. */
  owner: (d: Decision) => { name: string; currency: CurrencyCode }
  base: CurrencyCode
  calendar: PayCalendar
}): VerdictCopy {
  const { verdict: v, decision, base, calendar } = args
  const per = perPeriod(calendar)
  const fix: VerdictCopy['action'] = {
    label: 'Fix the gap',
    primary: true,
    to: decision ? { kind: decision.kind, id: decision.ownerId } : 'upcoming',
  }
  switch (v.kind) {
    case 'start':
      return v.reason === 'empty'
        ? {
            tone: 'neutral',
            title: 'Start your plan',
            sub: 'Add the bills you pay and the things you’re saving for. We’ll work out how much to set aside from each paycheck.',
            action: { label: 'Plan something', primary: true, to: 'chooser' },
          }
        : {
            tone: 'neutral',
            title: 'Add your income to see if you’re covered',
            sub: 'Your bills and goals are in. Add your paycheck and we’ll check that it covers them.',
            action: { label: 'Add income', primary: true, to: 'income' },
          }
    case 'covered':
      return {
        tone: 'ok',
        title: 'You’re covered',
        sub: `Every bill and goal in your plan fits in your pay. ${money(v.left, base)} is left for spending ${per}.`,
        action: { label: 'See what’s coming', primary: false, to: 'upcoming' },
      }
    case 'tight':
      return {
        tone: 'warn',
        title: 'Tight',
        sub: `Everything fits, but only ${money(v.left, base)} is left for spending ${per}.`,
        action: { label: 'See what’s coming', primary: false, to: 'upcoming' },
      }
    case 'short': {
      const owner = decision ? args.owner(decision) : null
      const lead =
        decision && owner && decision.kind === 'goal' && decision.deadline
          ? `${owner.name} needs ${money(decision.requiredPerPaycheck, owner.currency)} ${per} to be ready by ${monthYear(decision.deadline)}. Push it out or lower the target.`
          : owner
            ? `${owner.name} can’t be fully covered in time. Set aside more or change the plan.`
            : 'Push a goal out or lower what it needs.'
      return v.per === 'paycheck'
        ? {
            tone: 'danger',
            title: `Short by ${money(v.shortBy, base)} ${per}`,
            sub: `Your plan asks for more than you earn. ${lead}`,
            action: fix,
          }
        : {
            tone: 'danger',
            title: `Short by ${money(v.shortBy, base)}`,
            sub: `This paycheck fits, but not every date can be met. ${lead}`,
            action: fix,
          }
    }
  }
}

export type PaycheckPartKey = 'bills' | 'savingUp' | 'goals' | 'left'

export type PaycheckSegment = {
  key: PaycheckPartKey
  label: string
  note: string
  amount: number
  /** Share of the bar's scale, 0–100. */
  pct: number
  color: string
  section: PlanningSection
}

export type PaycheckBar = {
  segments: PaycheckSegment[]
  /** Where the pay ends on the bar (0–100) when the plan outruns it; null otherwise. */
  payAt: number | null
  /** The legend rows, Left for spending last (even when negative). */
  legend: PaycheckSegment[]
  /** "SR 12,000 · paid on the 25th". */
  caption: string
  income: number | null
}

export const PART_COLOR: Record<PaycheckPartKey, string> = {
  bills: 'var(--fp-text-3)',
  savingUp: 'var(--fp-chart-set-aside)',
  goals: 'var(--fp-goal)',
  left: 'var(--fp-accent)',
}

export function paycheckBar(
  p: EachPaycheck,
  base: CurrencyCode,
  calendar: PayCalendar,
): PaycheckBar {
  const left = p.left ?? 0
  const scale = Math.max(p.income ?? 0, p.planned, 1)
  const part = (
    key: PaycheckPartKey,
    label: string,
    note: string,
    amount: number,
    section: PlanningSection,
  ): PaycheckSegment => ({
    key,
    label,
    note,
    amount,
    pct: (Math.max(0, amount) / scale) * 100,
    color: PART_COLOR[key],
    section,
  })
  const legend = [
    part(
      'bills',
      'Bills',
      calendar.perYear === 12
        ? `${p.bills.count} monthly`
        : plural(p.bills.count, 'bill') + ' each paycheck',
      p.bills.total,
      'bills',
    ),
    part(
      'savingUp',
      'Saving up for bills',
      plural(p.savingUp.count, 'bill') + ' due later',
      p.savingUp.total,
      'bills',
    ),
    part(
      'goals',
      'Goals',
      plural(p.goals.count, 'goal'),
      p.goals.total,
      'goals',
    ),
    ...(p.income !== null
      ? [
          part(
            'left',
            'Left for spending',
            'groceries, fuel, eating out',
            left,
            'upcoming',
          ),
        ]
      : []),
  ].filter((s) => s.key === 'left' || s.amount > 0)
  const payday =
    calendar.kind === 'paycheck'
      ? calendar.stream.frequency === 'monthly'
        ? `paid on the ${ordinal(calendar.stream.day)}`
        : p.payday
          ? `next on ${dayMonth(p.payday)}`
          : ''
      : 'each month'
  return {
    segments: legend.filter((s) => s.pct > 0),
    payAt: p.income !== null && left < 0 ? (p.income / scale) * 100 : null,
    legend,
    caption:
      p.income !== null
        ? [money(p.income, base), payday].filter(Boolean).join(' · ')
        : 'Add your income to compare',
    income: p.income,
  }
}

export type EventCover = { label: string; tone: 'ok' | 'warn' | 'muted' }

export type DayEvent = {
  key: string
  date: string
  /** Days from today, 0–30. */
  day: number
  name: string
  amount: string
  color: string
  kind: 'bill' | 'payday'
  billId: string | null
  incomeId: string | null
  occurrence: string
  /** A bill's repeat ("Monthly"), or the income a payday comes from. */
  sub: string
  walletName: string | null
  autopay: boolean
  /** How much of a bill payment is set aside; null on a payday. */
  cover: EventCover | null
}

export const NEXT_DAYS = 30

function coverOf(r: UpcomingRow): EventCover | null {
  if (!r.coverage) return null
  switch (r.coverage.state) {
    case 'covered':
      return { label: 'Set aside ✓', tone: 'ok' }
    case 'partial':
      return {
        label: `${money(r.coverage.setAside, r.currency)} of ${money(r.remainder, r.currency)} set aside`,
        tone: 'warn',
      }
    case 'not_set_aside':
      return { label: 'Nothing set aside yet', tone: 'muted' }
  }
}

/** Bill payments and paydays in the next 30 days, for Overview's strip. */
export function next30Events(
  upcoming: UpcomingView,
  bills: ReadonlyArray<LocalBill>,
  today: string,
): DayEvent[] {
  const end = addDaysISO(today, NEXT_DAYS)
  const billOf = new Map(bills.map((b) => [b.id, b]))
  return upcoming.periods
    .flatMap((p) => [...p.payments, ...p.income])
    .filter((r) => r.item.date >= today && r.item.date <= end)
    .map((r) => {
      const payday = r.item.role === 'income'
      const bill = r.item.billId ? billOf.get(r.item.billId) : undefined
      return {
        key: r.id,
        date: r.item.date,
        day: daysBetween(today, r.item.date),
        name: payday ? 'Payday' : r.name,
        amount: `${payday ? '+' : '−'}${money(r.remainder, r.currency)}`,
        color: payday
          ? 'var(--fp-accent)'
          : (bill?.color ?? 'var(--fp-text-3)'),
        kind: payday ? ('payday' as const) : ('bill' as const),
        billId: r.item.billId,
        incomeId: r.item.incomeStreamId,
        occurrence: r.item.occurrence,
        sub: payday ? r.name : bill ? repeatLabel(bill) : 'Bill',
        walletName: r.walletName,
        autopay: bill?.autopay ?? false,
        cover: coverOf(r),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
}

export type DayGroup = {
  date: string
  day: number
  events: DayEvent[]
}

/** The events (date-sorted) gathered by day, one timeline dot each. */
export function groupByDay(events: ReadonlyArray<DayEvent>): DayGroup[] {
  const groups: DayGroup[] = []
  for (const e of events) {
    const last = groups.at(-1)
    if (last?.date === e.date) last.events.push(e)
    else groups.push({ date: e.date, day: e.day, events: [e] })
  }
  return groups
}

/** "Today", "Tomorrow", "in 9 days". */
export const daysAhead = (day: number): string =>
  day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : `in ${day} days`

export type LabelSide = 'above' | 'below'

/**
 * Sides and visibility for the timeline's labels, at their x positions (px, ascending). Labels
 * alternate; one too close to the last label on its side tries the other side, and hides (its
 * dot stays) when that side is crowded too.
 */
export function placeLabels(
  xs: ReadonlyArray<number>,
  minGap: number,
): Array<{ side: LabelSide; labelled: boolean }> {
  const last: Record<LabelSide, number> = { above: -Infinity, below: -Infinity }
  return xs.map((x, i) => {
    let side: LabelSide = i % 2 === 0 ? 'above' : 'below'
    if (x - last[side] < minGap) side = side === 'above' ? 'below' : 'above'
    const labelled = x - last[side] >= minGap
    if (labelled) last[side] = x
    return { side, labelled }
  })
}

/** "Needs SR 7,500 a paycheck to reach SR 75,000 by Aug 2027." */
export function decisionNote(
  d: Decision,
  owner: LocalBill | LocalGoal,
  calendar: PayCalendar,
): string {
  const c = owner.currency
  if (d.kind === 'goal') {
    const goal = owner as LocalGoal
    return goal.target && d.deadline
      ? `Needs ${money(d.requiredPerPaycheck, c)} ${perPeriod(calendar)} to reach ${money(goal.target, c)} by ${monthYear(d.deadline)}.`
      : `${money(d.shortBy, c)} short by its date.`
  }
  return d.deadline
    ? `${money(d.shortBy, c)} short when it’s due on ${dayMonth(d.deadline)}.`
    : `${money(d.shortBy, c)} short.`
}
