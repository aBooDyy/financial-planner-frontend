/**
 * Set-asides a bill's schedule no longer has a place for. A bill's set-aside covers one
 * occurrence by its exact date, so moving the due date, changing the repeat or the end date, or
 * skipping an occurrence leaves money on a date nothing will ever be paid on — it would be held
 * forever while the new occurrence is set aside for again. Each such set-aside goes to the open
 * occurrence nearest its old date. Money on an occurrence that was paid stays: what is left
 * there is the leftover prompt's call (03 §5). Pure.
 */
import type { LocalBill, LocalPlanned, LocalSetAside } from '#/db/types'
import { addMonthsISO, daysBetween } from '#/features/planned/data/dates'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { openOccurrences } from './occurrences'

/** A set-aside and the occurrence it now covers. */
export type Rekey = { id: string; occurrence: string }

/** How far past the furthest occurrence money sits on the open ones are looked for. */
const SEARCH_MONTHS = 24

function nearest(open: ReadonlyArray<string>, date: string): string {
  let best = open[0]
  for (const o of open) {
    if (Math.abs(daysBetween(date, o)) < Math.abs(daysBetween(date, best)))
      best = o
  }
  return best
}

export function strandedSetAsides(
  bill: LocalBill,
  payments: ReadonlyMap<string, LocalPlanned>,
  setAsides: ReadonlyArray<LocalSetAside>,
): Rekey[] {
  if (bill.deleted !== 0 || bill.closedAt !== null) return []
  const live = setAsides.filter(
    (a): a is LocalSetAside & { occurrence: string } =>
      a.billId === bill.id && a.occurrence !== null && isLiveSetAside(a),
  )
  if (live.length === 0) return []
  const furthest = live.reduce(
    (max, a) => (a.occurrence > max ? a.occurrence : max),
    bill.nextDue,
  )
  const open = openOccurrences(
    bill,
    payments,
    addMonthsISO(furthest, SEARCH_MONTHS),
  )
  if (open.length === 0) return []
  const onSchedule = new Set(open)
  return live
    .filter(
      (a) =>
        !onSchedule.has(a.occurrence) &&
        payments.get(a.occurrence)?.status !== 'done',
    )
    .map((a) => ({ id: a.id, occurrence: nearest(open, a.occurrence) }))
}
