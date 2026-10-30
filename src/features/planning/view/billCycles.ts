/**
 * A bill's due dates, for its detail panel and Pay now: what is overdue, what is coming and what
 * has been, each with what was paid and set aside for it. Pure.
 */
import type {
  LocalBill,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { addMonthsISO, daysBetween } from '#/features/planned/data/dates'
import {
  billOccurrences,
  earlierOccurrences,
  occurrenceAmount,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { ChipTone } from '#/features/planning/components/kit/StatusChip'
import { convertMinor } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { dayMonth, fullDate, money } from './format'

export type CycleState =
  | 'overdue'
  | 'due_today'
  | 'upcoming'
  | 'paid'
  | 'skipped'
  /** A past date of the schedule with nothing on record. */
  | 'unrecorded'

export type BillCycle = {
  occurrence: string
  plannedId: string | null
  state: CycleState
  /** Bill currency, as are `paid` and `setAside`. */
  amount: number
  paid: number
  /** Still set aside for it. */
  setAside: number
  /** The bill's estimate rather than a figure known for this occurrence. */
  estimate: boolean
  payments: LocalTransaction[]
  /** Its set-asides still live or used by a payment; the rest is in the history. */
  setAsides: LocalSetAside[]
}

export type BillCycles = {
  due: BillCycle[]
  upcoming: BillCycle[]
  past: BillCycle[]
  moreUpcoming: boolean
  morePast: boolean
}

export const CYCLES_UPCOMING = 4
export const CYCLES_PAST = 6
const CYCLES_PAST_MAX = 120

const LOOK_AHEAD_MONTHS = 120

type CycleInputs = {
  bill: LocalBill
  planned: ReadonlyArray<LocalPlanned>
  txns: ReadonlyArray<LocalTransaction>
  setAsides: ReadonlyArray<LocalSetAside>
  rates: RatesMap
  today: string
}

function cycleOf(
  occurrence: string,
  args: CycleInputs,
  rows: ReadonlyMap<string, LocalPlanned>,
): BillCycle {
  const { bill, rates, today } = args
  const row = rows.get(occurrence)
  const inBill = (a: { amount: number; currency: string }) =>
    convertMinor(a.amount, a.currency, bill.currency, rates)
  const payments = row
    ? args.txns
        .filter(
          (t) =>
            t.deleted === 0 && t.plannedId === row.id && t.billId === bill.id,
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    : []
  const setAsides = args.setAsides.filter(
    (a) =>
      a.deleted === 0 &&
      a.billId === bill.id &&
      a.occurrence === occurrence &&
      (a.releasedAt === null || a.releasedById !== null),
  )
  const stale =
    occurrence < bill.nextDue || bill.closedAt !== null
      ? ('unrecorded' as const)
      : null
  const state: CycleState =
    row?.status === 'skipped'
      ? 'skipped'
      : row?.status === 'done'
        ? 'paid'
        : (stale ??
          (occurrence < today
            ? 'overdue'
            : occurrence === today
              ? 'due_today'
              : 'upcoming'))
  return {
    occurrence,
    plannedId: row?.id ?? null,
    state,
    amount: occurrenceAmount(bill, row),
    paid: payments.reduce((sum, t) => sum + inBill(t), 0),
    setAside: setAsides
      .filter(isLiveSetAside)
      .reduce((sum, a) => sum + inBill(a), 0),
    estimate: bill.amountVaries && !row?.pinned,
    payments,
    setAsides,
  }
}

/** The schedule's earlier dates worth listing: none beside a row, none before the bill existed. */
function steppedBack(
  args: CycleInputs,
  rows: ReadonlyMap<string, LocalPlanned>,
  count: number,
  beforeStart: boolean,
): string[] {
  const { bill } = args
  if (bill.closedAt !== null || bill.frequency === null) return []
  const halfCycle = 365 / frequencyMetaOf(bill, 'monthly').perYear / 2
  const started = bill.createdAt.slice(0, 10)
  return earlierOccurrences(bill, rows, count).filter(
    (o) =>
      (beforeStart || o >= started) &&
      ![...rows.keys()].some(
        (held) => Math.abs(daysBetween(held, o)) < halfCycle,
      ),
  )
}

export function billCycles(
  args: CycleInputs & {
    upcoming?: number
    past?: number
    /** Also list dates from before the bill was added. */
    beforeStart?: boolean
  },
): BillCycles {
  const { bill, today } = args
  const upcomingCount = args.upcoming ?? CYCLES_UPCOMING
  const pastCount = args.past ?? CYCLES_PAST
  const rows = paymentRowsOf(bill.id, args.planned)
  const ahead = billOccurrences(
    bill,
    rows,
    addMonthsISO(
      today > bill.nextDue ? today : bill.nextDue,
      LOOK_AHEAD_MONTHS,
    ),
  )
  const dates = new Set([
    ...ahead,
    ...rows.keys(),
    ...steppedBack(args, rows, pastCount, args.beforeStart ?? false),
  ])
  const cycles = [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((o) => cycleOf(o, args, rows))

  const due = cycles.filter(
    (c) => c.state === 'overdue' || c.state === 'due_today',
  )
  const coming = cycles.filter(
    (c) =>
      c.state === 'upcoming' ||
      (c.occurrence > today && (c.state === 'paid' || c.state === 'skipped')),
  )
  const past = cycles
    .filter(
      (c) => c.occurrence <= today && !due.includes(c) && !coming.includes(c),
    )
    .concat(
      cycles.filter((c) => c.occurrence > today && c.state === 'unrecorded'),
    )
    .sort((a, b) => b.occurrence.localeCompare(a.occurrence))
  return {
    due,
    upcoming: coming.slice(0, upcomingCount),
    past: past.slice(0, pastCount),
    moreUpcoming: coming.length > upcomingCount,
    morePast:
      past.length > pastCount ||
      (bill.frequency !== null &&
        bill.closedAt === null &&
        pastCount < CYCLES_PAST_MAX),
  }
}

/** "Sep 15", or "Sep 15, 2025" outside this year. */
export const cycleDate = (iso: string, today: string): string =>
  iso.slice(0, 4) === today.slice(0, 4) ? dayMonth(iso) : fullDate(iso)

/** What the cycle costs or cost, as its row shows it. */
export function cycleFigure(cycle: BillCycle, bill: LocalBill): string {
  const c = bill.currency
  if (cycle.state === 'paid') return money(cycle.paid || cycle.amount, c)
  if (cycle.state === 'skipped' || cycle.state === 'unrecorded') return '—'
  return approxMoney(cycle.amount, c, cycle.estimate)
}

/** "≈SR 400" for an estimate. */
export const approxMoney = (
  amount: number,
  currency: string,
  estimate: boolean,
): string => `${estimate ? '≈' : ''}${money(amount, currency)}`

const lateBy = (days: number): string =>
  days === 1 ? '1 day late' : `${days} days late`

const inDays = (days: number): string =>
  days === 1 ? 'Tomorrow' : `In ${days} days`

/** The line under a cycle's date. */
export function cycleSub(
  cycle: BillCycle,
  bill: LocalBill,
  walletName: (id: string) => string,
  today: string,
): string {
  const c = bill.currency
  const held =
    cycle.setAside > 0 ? `${money(cycle.setAside, c)} set aside` : null
  const partPaid =
    cycle.paid > 0 && cycle.paid < cycle.amount
      ? `${money(cycle.paid, c)} of ${money(cycle.amount, c)} paid`
      : null
  switch (cycle.state) {
    case 'overdue':
      return [lateBy(daysBetween(cycle.occurrence, today)), partPaid, held]
        .filter(Boolean)
        .join(' · ')
    case 'due_today':
      return [partPaid, held].filter(Boolean).join(' · ') || 'Today'
    case 'upcoming':
      return [inDays(daysBetween(today, cycle.occurrence)), partPaid, held]
        .filter(Boolean)
        .join(' · ')
    case 'paid': {
      const first = cycle.payments.at(0)
      if (cycle.payments.length > 1)
        return `Paid in ${cycle.payments.length} payments`
      return first
        ? `Paid ${cycleDate(first.date, today)} · ${walletName(first.walletId)}`
        : 'Closed'
    }
    case 'skipped':
      return 'Not paying this one'
    case 'unrecorded':
      return 'No payment on record'
  }
}

export function cycleChip(cycle: BillCycle): {
  tone: ChipTone
  label: string
} {
  switch (cycle.state) {
    case 'overdue':
      return { tone: 'danger', label: 'Overdue' }
    case 'due_today':
      return { tone: 'warn', label: 'Due today' }
    case 'upcoming':
      return cycle.setAside + cycle.paid >= cycle.amount
        ? { tone: 'ok', label: 'Covered ✓' }
        : cycle.setAside > 0
          ? { tone: 'blue', label: 'Saving up' }
          : { tone: 'neutral', label: 'Not set aside' }
    case 'paid':
      return { tone: 'ok', label: 'Paid' }
    case 'skipped':
      return { tone: 'neutral', label: 'Skipped' }
    case 'unrecorded':
      return { tone: 'neutral', label: 'Not recorded' }
  }
}

export type PayChoiceGroup = {
  label: string
  choices: Array<{ occurrence: string; label: string }>
}

/** What Pay now offers: what is owed, what is coming, and what was never paid before that. */
export function payChoices(
  cycles: BillCycles,
  today: string,
): PayChoiceGroup[] {
  const choice = (c: BillCycle, note: string) => ({
    occurrence: c.occurrence,
    label: `${cycleDate(c.occurrence, today)} · ${note}`,
  })
  return [
    {
      label: 'Overdue',
      choices: cycles.due.map((c) =>
        choice(c, c.state === 'due_today' ? 'Due today' : 'Overdue'),
      ),
    },
    {
      label: 'Coming up',
      choices: cycles.upcoming
        .filter((c) => c.state === 'upcoming')
        .map((c) => choice(c, 'Coming up')),
    },
    {
      label: 'Earlier',
      choices: cycles.past
        .filter((c) => c.state === 'skipped' || c.state === 'unrecorded')
        .map((c) =>
          choice(c, c.state === 'skipped' ? 'Skipped' : 'Not recorded'),
        ),
    },
  ].filter((g) => g.choices.length > 0)
}

/** Paid cycles that have to agree before their average replaces an estimate. */
const ESTIMATE_MIN_PAID = 2
const ESTIMATE_LOOKBACK = 3
const ESTIMATE_DRIFT = 0.05

/**
 * What the last few payments of a varying bill averaged, when that has drifted from the bill's
 * estimate; null otherwise.
 */
export function estimateSuggestion(
  bill: Pick<LocalBill, 'amount' | 'amountVaries'>,
  past: ReadonlyArray<BillCycle>,
): number | null {
  if (!bill.amountVaries) return null
  const paid = past
    .filter((c) => c.state === 'paid' && c.paid > 0)
    .slice(0, ESTIMATE_LOOKBACK)
  if (paid.length < ESTIMATE_MIN_PAID) return null
  const average = Math.round(
    paid.reduce((sum, c) => sum + c.paid, 0) / paid.length,
  )
  return Math.abs(average - bill.amount) / Math.max(bill.amount, 1) <
    ESTIMATE_DRIFT
    ? null
    : average
}
