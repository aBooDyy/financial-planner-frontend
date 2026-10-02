/**
 * Upcoming, by payday (04 §5): Needs confirming first, then the planned rows grouped by pay
 * period — this one (from today to the day before payday), the next paycheck, then later ones
 * — each with what comes in, what goes out and what is left for spending. Bill payments say
 * whether their occurrence is set aside. Pure, over the Planned tab's row views.
 */
import type { LocalBalanceNode } from '#/db/types'
import type { PlannedRowView } from '#/features/planned/data/views'
import { buildPlannedList } from '#/features/planned/data/views'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { convertMinor } from '#/lib/currency'
import { tracksOf } from './funding'
import { occurrenceFrom, paymentRowsByBill } from './occurrences'
import { periodsBetween } from './payPeriods'
import type { PayPeriod } from './payPeriods'
import { cycleOf } from './status'

export type RowCoverage = {
  /** Set aside in full, in part, or not yet. */
  state: 'covered' | 'partial' | 'not_set_aside'
  /** In the row's currency. */
  setAside: number
}

export type UpcomingRow = PlannedRowView & {
  /** Bill payments only. */
  coverage: RowCoverage | null
  /** A bill saved up for over several paydays (the collapsed summary names these). */
  savedUp: boolean
}

export type UpcomingPeriod = {
  period: PayPeriod
  /** `this`: today to the day before payday · `next`: the next paycheck · `later`. */
  kind: 'this' | 'next' | 'later'
  rows: UpcomingRow[]
  payments: UpcomingRow[]
  setAsides: UpcomingRow[]
  income: UpcomingRow[]
  /** Base currency. */
  incomeIn: number
  paymentsOut: number
  setAsideOut: number
  /**
   * What pay leaves for spending, as Safe to spend counts it: `incomeIn` less the payments'
   * parts nothing is set aside for yet, less the set-asides for what falls due after the
   * period (one for a payment inside it is that payment, counted once). May be negative.
   */
  left: number
}

export type UpcomingView = {
  /** Needs confirming: open rows whose date has come, oldest first. */
  due: UpcomingRow[]
  dueCount: number
  periods: UpcomingPeriod[]
  isEmpty: boolean
}

export function buildUpcoming(args: {
  inputs: PlannerInputs
  state: PlannerState
  nodes: ReadonlyArray<LocalBalanceNode>
  /** ISO date. */
  today: string
}): UpcomingView {
  const { inputs, state, today } = args
  const { base, rates } = inputs
  const list = buildPlannedList({
    planned: inputs.planned,
    nodes: args.nodes,
    index: state.index,
    rates,
    base,
    today,
  })
  const bills = new Map(inputs.bills.map((b) => [b.id, b]))
  const heldFor = (billId: string, occurrence: string, currency: string) =>
    inputs.setAsides
      .filter(
        (a) =>
          isLiveSetAside(a) &&
          a.billId === billId &&
          a.occurrence === occurrence,
      )
      .reduce(
        (sum, a) => sum + convertMinor(a.amount, a.currency, currency, rates),
        0,
      )

  const enrich = (row: PlannedRowView): UpcomingRow => {
    const { item } = row
    const bill =
      item.role === 'payment' && item.billId
        ? bills.get(item.billId)
        : undefined
    if (!bill) return { ...row, coverage: null, savedUp: false }
    const setAside = heldFor(bill.id, item.occurrence, item.currency)
    const track = tracksOf(state.funding, 'bill', bill.id).find(
      (t) => t.occurrence === item.occurrence,
    )
    return {
      ...row,
      coverage: {
        state:
          setAside >= row.remainder && row.remainder > 0
            ? 'covered'
            : setAside > 0
              ? 'partial'
              : 'not_set_aside',
        setAside,
      },
      savedUp: cycleOf(bill, track, state.funding) === 'save_up',
    }
  }

  const due = list.due.map(enrich)
  const ahead = [...list.next, ...list.later].map(enrich)
  const last = ahead.at(-1)?.item.date ?? today
  const inBase = (r: UpcomingRow) =>
    convertMinor(r.remainder, r.currency, base, rates)
  const sum = (rows: UpcomingRow[]) => rows.reduce((a, r) => a + inBase(r), 0)
  const uncovered = (rows: UpcomingRow[]) =>
    rows.reduce(
      (a, r) =>
        a +
        convertMinor(
          Math.max(0, r.remainder - (r.coverage?.setAside ?? 0)),
          r.currency,
          base,
          rates,
        ),
      0,
    )
  const paymentRows = paymentRowsByBill(inputs.planned)
  /** The occurrence a bill set-aside row goes toward; null for a goal's. */
  const coversOf = (r: UpcomingRow): string | null => {
    const bill = r.item.billId ? bills.get(r.item.billId) : undefined
    return bill
      ? occurrenceFrom(
          bill,
          r.item.date,
          paymentRows.get(bill.id) ?? new Map(),
        )
      : null
  }

  const periods = periodsBetween(state.funding.calendar, today, last).map(
    (period, i): UpcomingPeriod => {
      const rows = ahead.filter(
        (r) => r.item.date >= period.start && r.item.date <= period.end,
      )
      const payments = rows.filter((r) => r.item.role === 'payment')
      const setAsides = rows.filter((r) => r.item.role === 'set_aside')
      const income = rows.filter((r) => r.item.role === 'income')
      const incomeIn = sum(income)
      const paymentsOut = sum(payments)
      const setAsideOut = sum(setAsides)
      const forLater = setAsides.filter((r) => {
        const covers = coversOf(r)
        return covers === null || covers > period.end
      })
      return {
        period,
        kind: i === 0 ? 'this' : i === 1 ? 'next' : 'later',
        rows,
        payments,
        setAsides,
        income,
        incomeIn,
        paymentsOut,
        setAsideOut,
        left: incomeIn - uncovered(payments) - sum(forLater),
      }
    },
  )
  return {
    due,
    dueCount: due.length,
    periods,
    isEmpty: due.length + ahead.length === 0,
  }
}
