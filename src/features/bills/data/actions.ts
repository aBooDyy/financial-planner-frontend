/**
 * "Mark as done" / "End this bill" and Reopen — actions, not edits: each is applied here at
 * once and queued as its own outbox entry, which the server applies atomically. A closed bill
 * stays editable (its PATCH never touches `closedAt`).
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalBill } from '#/db/types'
import { isoOf } from '#/features/planned/data/dates'
import { billOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { savePlanned, settlementsOf } from '#/features/planned/data/rows'
import {
  openOccurrenceFrom,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import { setBillNextDue } from './mutations'
import { queueClose } from '#/features/setAsides/data/leftover'
import type { Leftover } from '#/features/setAsides/data/leftover'

const now = () => new Date().toISOString()

export type CloseOptions = {
  /** The close date; defaults to today. */
  closedAt?: string
  /** What happens to money still set aside for it; defaults to freeing it. */
  leftover?: Leftover
}

/**
 * Close a bill: no more occurrences. Its live set-asides are released on the close date (or
 * moved to another open bill or goal), and its open, unsettled planned rows after that date
 * go. Closing a closed bill does nothing.
 */
export async function closeBill(
  id: string,
  options: CloseOptions = {},
): Promise<void> {
  const bill = await db.bills.get(id)
  if (!bill || bill.deleted !== 0 || bill.closedAt !== null) return
  const closedAt = options.closedAt ?? isoOf(new Date())
  await queueClose(
    { entity: 'bill', id },
    closedAt,
    options.leftover ?? { kind: 'free' },
    async () => {
      await db.bills.put({ ...bill, closedAt, updatedAt: now(), dirty: 1 })
    },
  )
  schedulePush()
}

/**
 * Where a reopened bill picks up. A repeating one resumes at its first open occurrence from
 * today — the ones that fell due while it was closed are not owed. A one-off keeps its date, and
 * its payment, resolved when it was closed, waits again.
 */
async function resume(bill: LocalBill): Promise<void> {
  const rows = await db.plannedTransactions.where('billId').equals(bill.id).toArray()
  const payments = paymentRowsOf(bill.id, rows)
  if (bill.frequency !== null) {
    const nextDue = openOccurrenceFrom(bill, payments, isoOf(new Date()))
    if (nextDue !== bill.nextDue) await setBillNextDue(bill.id, nextDue)
    return
  }
  const row = payments.get(bill.nextDue)
  if (row?.status !== 'skipped') return
  const { txns, setAsides } = await settlementsOf([row.id])
  if (txns.length + setAsides.length === 0)
    await savePlanned({ ...row, status: 'open' })
}

/**
 * Undo a close: the bill picks up from today (`resume`) and its plan is rewritten from today.
 * What the close released stays released.
 */
export async function reopenBill(id: string): Promise<void> {
  const bill = await db.bills.get(id)
  if (!bill || bill.deleted !== 0 || bill.closedAt === null) return
  // Queued before the reopen: the PATCH goes out on the version the server still holds.
  await resume(bill)
  await db.transaction('rw', db.bills, db.outbox, async () => {
    const latest = (await db.bills.get(id)) ?? bill
    await db.bills.put({ ...latest, closedAt: null, updatedAt: now(), dirty: 1 })
    await db.outbox.add({
      op: 'reopen',
      entity: 'bill',
      id,
      payload: null,
      baseVersion: null,
      createdAt: now(),
    })
  })
  requestPlanRecalc(billOwner(id), { quiet: true })
  schedulePush()
}
