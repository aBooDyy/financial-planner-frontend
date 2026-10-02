/**
 * A bill's occurrences — the due dates it falls on — and which of them are settled. A bill
 * steps from its schedule's anchor on its cadence; a month step keeps the anchor's day, clamped
 * to short months (Jan 31 → Feb 28 → Mar 31). A planned PAYMENT row that is no longer open
 * (paid in full, closed with the rest abandoned, or skipped) settles its occurrence.
 */
import type { LocalBill, LocalPlanned } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { addMonthsISO, dateOf, isoOf } from '#/features/planned/data/dates'

/** How many occurrences a list may hold — a daily bill over more than a year. */
const MAX_OCCURRENCES = 600

const lastDayOf = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate()

/** The occurrence `n` cycles after `anchor`. */
export function stepOccurrence(
  anchor: string,
  bill: Pick<LocalBill, 'frequency' | 'customInterval' | 'customUnit'>,
  n: number,
): string {
  const { unit, every } = frequencyMetaOf(bill, 'monthly').cadence
  const d = dateOf(anchor)
  if (unit === 'month') {
    const month = d.getMonth() + n * every
    const year = d.getFullYear() + Math.floor(month / 12)
    const m = ((month % 12) + 12) % 12
    return isoOf(new Date(year, m, Math.min(d.getDate(), lastDayOf(year, m))))
  }
  const days = unit === 'week' ? 7 * every : every
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * days))
}

/** Where a bill's occurrences step from: occurrence `n` is `anchor` stepped `offset + n` times. */
type Schedule = { anchor: string; offset: number }

const monthIndex = (iso: string): number =>
  Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1

/**
 * `nextDue`, unless it sits on a day a short month clamped it to: then the latest earlier
 * payment occurrence that steps onto it exactly (Jan 31 for a Feb 28 `nextDue`), so the month
 * after comes back to the 31st. Only `nextDue` is stored, so the day it was clamped from is
 * read back from the bill's own payment rows.
 */
function scheduleOf(
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
): Schedule {
  const own: Schedule = { anchor: bill.nextDue, offset: 0 }
  if (bill.frequency === null) return own
  const { unit, every } = frequencyMetaOf(bill, 'monthly').cadence
  if (unit !== 'month') return own
  let best: Schedule | null = null
  for (const occurrence of payments.keys()) {
    if (occurrence >= bill.nextDue || (best && occurrence <= best.anchor))
      continue
    const months = monthIndex(bill.nextDue) - monthIndex(occurrence)
    if (months % every !== 0) continue
    const offset = months / every
    if (stepOccurrence(occurrence, bill, offset) === bill.nextDue)
      best = { anchor: occurrence, offset }
  }
  return best ?? own
}

const occurrenceAt = (
  bill: LocalBill,
  schedule: Schedule,
  n: number,
): string => stepOccurrence(schedule.anchor, bill, schedule.offset + n)

/**
 * Every occurrence from `nextDue` through `through` (inclusive), stopping at `endsOn`. A
 * closed bill has none; a one-off has at most its `nextDue`. `payments` are the bill's payment
 * rows by occurrence (`paymentRowsOf`), which keep a month-end bill on its day.
 */
export function billOccurrences(
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
  through: string,
): string[] {
  if (bill.closedAt !== null) return []
  if (bill.frequency === null)
    return bill.nextDue <= through ? [bill.nextDue] : []
  const last =
    bill.endsOn !== null && bill.endsOn < through ? bill.endsOn : through
  const schedule = scheduleOf(bill, payments)
  const out: string[] = []
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const at = occurrenceAt(bill, schedule, n)
    if (at > last) break
    out.push(at)
  }
  return out
}

/** The occurrence before `occurrence` on the bill's schedule; '' for a one-off. */
export function occurrenceBefore(
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
  occurrence: string,
): string {
  if (bill.frequency === null) return ''
  const schedule = scheduleOf(bill, payments)
  let n = 0
  while (n < MAX_OCCURRENCES && occurrenceAt(bill, schedule, n) < occurrence)
    n++
  return occurrenceAt(bill, schedule, n - 1)
}

/** A bill's planned payment rows by occurrence. */
export function paymentRowsOf(
  billId: string,
  planned: ReadonlyArray<LocalPlanned>,
): Map<string, LocalPlanned> {
  const out = new Map<string, LocalPlanned>()
  for (const p of planned) {
    if (
      p.deleted === 0 &&
      p.billId === billId &&
      p.origin === 'bill' &&
      p.role === 'payment'
    )
      out.set(p.occurrence, p)
  }
  return out
}

/** Every bill's planned payment rows by occurrence, in one pass. */
export function paymentRowsByBill(
  planned: ReadonlyArray<LocalPlanned>,
): Map<string, Map<string, LocalPlanned>> {
  const out = new Map<string, Map<string, LocalPlanned>>()
  for (const p of planned) {
    if (p.deleted !== 0 || p.origin !== 'bill' || p.role !== 'payment') continue
    if (!p.billId) continue
    const rows = out.get(p.billId) ?? new Map<string, LocalPlanned>()
    rows.set(p.occurrence, p)
    out.set(p.billId, rows)
  }
  return out
}

/** Settled: its payment row exists and is no longer open. */
export const isSettledOccurrence = (
  rows: ReadonlyMap<string, LocalPlanned>,
  occurrence: string,
): boolean => {
  const row = rows.get(occurrence)
  return row !== undefined && row.status !== 'open'
}

/**
 * The bill's first occurrence from `nextDue` on that is not settled — what `nextDue` should
 * read once an occurrence is paid. A one-off keeps its only date.
 */
export function firstOpenOccurrence(
  bill: LocalBill,
  rows: ReadonlyMap<string, LocalPlanned>,
): string {
  if (bill.frequency === null) return bill.nextDue
  const schedule = scheduleOf(bill, rows)
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const at = occurrenceAt(bill, schedule, n)
    if (!isSettledOccurrence(rows, at)) return at
  }
  return bill.nextDue
}

/**
 * The occurrence money set aside for a bill on `date` goes toward: its first open occurrence
 * due on or after that date (within two years).
 */
export const occurrenceFrom = (
  bill: LocalBill,
  date: string,
  rows: ReadonlyMap<string, LocalPlanned>,
): string | null =>
  billOccurrences(bill, rows, addMonthsISO(date, 24)).find(
    (o) => o >= date && !isSettledOccurrence(rows, o),
  ) ?? null

/**
 * The first open occurrence on or after `date` — where a bill picks up again after a break;
 * `nextDue` when there is none (an ended bill, a one-off).
 */
export function openOccurrenceFrom(
  bill: LocalBill,
  rows: ReadonlyMap<string, LocalPlanned>,
  date: string,
): string {
  if (bill.frequency === null) return bill.nextDue
  const schedule = scheduleOf(bill, rows)
  const last = bill.endsOn ?? '9999-12-31'
  for (let n = 0; n < MAX_OCCURRENCES * 10; n++) {
    const at = occurrenceAt(bill, schedule, n)
    if (at > last) break
    if (at >= date && !isSettledOccurrence(rows, at)) return at
  }
  return bill.nextDue
}

/** The bill's open occurrences through `through`, in date order. */
export const openOccurrences = (
  bill: LocalBill,
  rows: ReadonlyMap<string, LocalPlanned>,
  through: string,
): string[] =>
  billOccurrences(bill, rows, through).filter(
    (o) => !isSettledOccurrence(rows, o),
  )
