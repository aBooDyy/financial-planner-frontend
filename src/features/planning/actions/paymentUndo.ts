/**
 * Taking a payment back — deleted, unlinked from its bill or goal, or edited — undoes what it
 * did to the plan (03 §5 in reverse): what it released is set aside again, and a bill's
 * `nextDue` steps back to an occurrence the payment no longer settles.
 */
import { db } from '#/db/db'
import type { LocalSetAside } from '#/db/types'
import { setBillNextDue } from '#/features/bills/data/mutations'
import { PLANNED_NAMESPACE, uuidv5 } from '#/features/planned/data/ids'
import { createSetAside } from '#/features/setAsides/data/mutations'
import type { SetAsideOwner } from '#/features/setAsides/data/mutations'

/** One restore per released row, so restoring twice never sets the money aside twice. */
const restoredIdOf = (releasedId: string): string =>
  uuidv5(`${releasedId}:restored`, PLANNED_NAMESPACE)

/** The row's owner while it can still hold money: open, not deleted. */
async function liveOwner(row: LocalSetAside): Promise<SetAsideOwner | null> {
  if (row.goalId) {
    const goal = await db.goals.get(row.goalId)
    return goal && goal.deleted === 0 && goal.closedAt === null
      ? { goalId: goal.id }
      : null
  }
  if (!row.billId) return null
  const bill = await db.bills.get(row.billId)
  return bill && bill.deleted === 0 && bill.closedAt === null
    ? { billId: bill.id, occurrence: row.occurrence }
    : null
}

async function liveWallet(walletId: string | null): Promise<boolean> {
  if (!walletId) return false
  const node = await db.balanceNodes.get(walletId)
  return (
    node !== undefined &&
    node.deleted === 0 &&
    node.kind === 'wallet' &&
    node.archivedAt === null
  )
}

/**
 * Set aside again what these payments released: a new live row per released one, with its
 * owner, wallet, occurrence, amount, date and planned link. Money whose bill or goal has since
 * closed or gone, or whose wallet is archived or gone, stays free — as closing or archiving
 * would have left it.
 */
export async function restoreReleasedBy(
  paymentIds: ReadonlyArray<string>,
): Promise<void> {
  if (paymentIds.length === 0) return
  const ids = new Set(paymentIds)
  const released = await db.setAsides
    .filter(
      (a) =>
        a.deleted === 0 &&
        a.releasedAt !== null &&
        a.releasedById !== null &&
        ids.has(a.releasedById),
    )
    .toArray()
  for (const row of released) {
    const owner = await liveOwner(row)
    if (!owner || !(await liveWallet(row.walletId))) continue
    await createSetAside(owner, {
      id: restoredIdOf(row.id),
      source: 'wallet',
      walletId: row.walletId,
      externalLabel: null,
      amount: row.amount,
      currency: row.currency,
      note: row.note,
      date: row.date,
      plannedId: row.plannedId,
    })
  }
}

/**
 * Bill payment rows a taken-back payment may have reopened: `nextDue` steps back to each one
 * still open that comes before it (`syncBillNextDue` only ever moves forward).
 */
export async function stepNextDueBack(
  plannedIds: ReadonlyArray<string | null | undefined>,
): Promise<void> {
  for (const plannedId of plannedIds) {
    if (!plannedId) continue
    const row = await db.plannedTransactions.get(plannedId)
    if (!row || row.deleted !== 0 || row.status !== 'open') continue
    if (row.role !== 'payment' || !row.billId) continue
    const bill = await db.bills.get(row.billId)
    if (bill && bill.deleted === 0 && row.occurrence < bill.nextDue)
      await setBillNextDue(bill.id, row.occurrence)
  }
}
