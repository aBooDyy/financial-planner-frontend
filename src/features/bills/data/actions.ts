/**
 * "Mark as done" / "End this bill" and Reopen — actions, not edits: each is applied here at
 * once and queued as its own outbox entry, which the server applies atomically. A closed bill
 * stays editable (its PATCH never touches `closedAt`).
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { isoOf } from '#/features/planned/data/dates'
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

/** Undo a close: the bill plans again from today. What the close released stays released. */
export async function reopenBill(id: string): Promise<void> {
  const bill = await db.bills.get(id)
  if (!bill || bill.deleted !== 0 || bill.closedAt === null) return
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await db.bills.put({ ...bill, closedAt: null, updatedAt: now(), dirty: 1 })
    await db.outbox.add({
      op: 'reopen',
      entity: 'bill',
      id,
      payload: null,
      baseVersion: null,
      createdAt: now(),
    })
  })
  schedulePush()
}
