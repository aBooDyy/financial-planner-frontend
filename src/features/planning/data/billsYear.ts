/**
 * What bills cost over a whole year: twelve calendar months from this one. Each month holds what
 * was already paid in it plus what is still open in it, so paying a bill never shrinks the year.
 * Base currency. Pure.
 */
import type { PlannerInputs } from '#/features/planned/data/state'
import { addDaysISO, addMonthsISO } from '#/features/planned/data/dates'
import { convertMinor } from '#/lib/currency'
import {
  occurrenceAmount,
  openOccurrences,
  paymentRowsByBill,
} from './occurrences'
import { incomeBetween } from './payPeriods'

const MONTHS = 12

export type BillsYearMonth = {
  /** `YYYY-MM`. */
  month: string
  amount: number
}

export type BillsYear = {
  months: BillsYearMonth[]
  total: number
  /** The total spread evenly over the twelve months. */
  perMonth: number
  /** The part of the total on bills marked nice to have. */
  niceToHave: number
  /** What the income streams bring in over the same months. */
  income: number
  /** An open occurrence stands on an estimate, or on a bill with no amount yet. */
  estimated: boolean
}

export function buildBillsYear(
  inputs: PlannerInputs,
  today: string,
): BillsYear {
  const { base, rates } = inputs
  const toBase = (amount: number, currency: string) =>
    convertMinor(amount, currency, base, rates)

  const first = `${today.slice(0, 7)}-01`
  const last = addDaysISO(addMonthsISO(first, MONTHS), -1)
  const months = Array.from({ length: MONTHS }, (_, i) => ({
    month: addMonthsISO(first, i).slice(0, 7),
    amount: 0,
  }))
  const byMonth = new Map(months.map((m) => [m.month, m]))
  const bills = new Map(inputs.bills.map((b) => [b.id, b]))
  let niceToHave = 0
  let estimated = false

  const add = (date: string, amount: number, mustPay: boolean) => {
    const month = byMonth.get(date.slice(0, 7))
    if (!month) return
    month.amount += amount
    if (!mustPay) niceToHave += amount
  }

  const paidOnRow = new Map<string, number>()
  for (const t of inputs.txns) {
    if (t.type !== 'spend' || !t.billId) continue
    const inBase = toBase(t.amount, t.currency)
    add(t.date, inBase, bills.get(t.billId)?.mustPay ?? true)
    if (t.plannedId)
      paidOnRow.set(t.plannedId, (paidOnRow.get(t.plannedId) ?? 0) + inBase)
  }

  const payments = paymentRowsByBill(inputs.planned)
  for (const bill of inputs.bills) {
    const rows = payments.get(bill.id) ?? new Map()
    for (const occurrence of openOccurrences(bill, rows, last)) {
      if (!byMonth.has(occurrence.slice(0, 7))) continue
      const row = rows.get(occurrence)
      const owed =
        toBase(occurrenceAmount(bill, row), bill.currency) -
        (row ? (paidOnRow.get(row.id) ?? 0) : 0)
      add(occurrence, Math.max(owed, 0), bill.mustPay)
      if (bill.amount === 0 || (bill.amountVaries && !row?.pinned))
        estimated = true
    }
  }

  const total = months.reduce((sum, m) => sum + m.amount, 0)
  return {
    months,
    total,
    perMonth: total / MONTHS,
    niceToHave,
    income: incomeBetween(inputs.income, first, last, base, rates),
    estimated,
  }
}
