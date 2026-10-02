/**
 * Saving a spend from the transaction dialog or QuickAdd. One that pays a bill takes the same
 * path as Pay now (03 §5): it settles the occurrence's planned payment, releases what that
 * occurrence had set aside in the paying wallet, moves the bill's `nextDue` on, and hands back
 * what other wallets still hold so the leftover prompt can ask about it.
 */
import { db } from '#/db/db'
import { setBillNextDue } from '#/features/bills/data/mutations'
import { syncBillNextDue } from '#/features/planned/data/mutations'
import {
  billPaymentTarget,
  settleBillPayment,
} from '#/features/planning/actions/payBill'
import type { BillPaymentTarget } from '#/features/planning/actions/payBill'
import { MoneyActionError } from '#/features/planning/actions/errors'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from './mutations'
import type { TransactionDraft } from './mutations'

/** Money a bill payment left set aside in other wallets: what the leftover prompt asks about. */
export type LeftoverPrompt = {
  report: LeftoverReport
  payingWalletId: string
  date: string
}

const billOf = (draft: TransactionDraft): string | null =>
  draft.type === 'spend' ? (draft.billId ?? null) : null

/** The row to settle, or null when the bill can no longer be paid (closed, deleted). */
async function targetFor(
  billId: string,
  plannedId: string | null,
): Promise<BillPaymentTarget | null> {
  try {
    return await billPaymentTarget(billId, plannedId)
  } catch (err) {
    if (err instanceof MoneyActionError) return null
    throw err
  }
}

async function settle(
  id: string,
  draft: TransactionDraft,
  billId: string,
  target: BillPaymentTarget,
): Promise<LeftoverPrompt | null> {
  const report = await settleBillPayment(billId, target.occurrence, {
    id,
    walletId: draft.walletId,
    amount: draft.amount,
    currency: draft.currency,
    date: draft.date,
  })
  return report.lines.length > 0
    ? { report, payingWalletId: draft.walletId, date: draft.date }
    : null
}

/**
 * A payment unlinked, cut or deleted can reopen the occurrence it settled; `nextDue` then steps
 * back to it when it comes first (`syncBillNextDue` only ever moves forward).
 */
async function stepBackTo(plannedId: string | null | undefined): Promise<void> {
  if (!plannedId) return
  const row = await db.plannedTransactions.get(plannedId)
  if (!row || row.deleted !== 0 || row.status !== 'open') return
  if (row.role !== 'payment' || !row.billId) return
  const bill = await db.bills.get(row.billId)
  if (bill && bill.deleted === 0 && row.occurrence < bill.nextDue)
    await setBillNextDue(bill.id, row.occurrence)
}

/** A new spend or income entry. A bill payment comes back with its leftover prompt, if any. */
export async function saveNewTransaction(
  draft: TransactionDraft,
): Promise<LeftoverPrompt | null> {
  const billId = billOf(draft)
  const target = billId
    ? await targetFor(billId, draft.plannedId ?? null)
    : null
  if (!billId || !target) {
    await createTransaction(draft)
    return null
  }
  const id = await createTransaction({ ...draft, plannedId: target.plannedId })
  return settle(id, draft, billId, target)
}

/**
 * An edited entry. One newly linked to a bill is paid like a new payment; otherwise the bill's
 * `nextDue` is only brought back in line with what is settled.
 */
export async function saveTransactionEdit(
  id: string,
  draft: TransactionDraft,
): Promise<LeftoverPrompt | null> {
  const before = await db.transactions.get(id)
  // Mirrors `updateTransaction`: an undefined link leaves the stored one alone.
  const billId =
    draft.billId !== undefined ? draft.billId : (before?.billId ?? null)
  const sameLink =
    before !== undefined &&
    (before.billId ?? null) === billId &&
    (draft.plannedId === undefined || before.plannedId === draft.plannedId)
  const target =
    billId && draft.type === 'spend' && !sameLink
      ? await targetFor(billId, draft.plannedId ?? null)
      : null

  await updateTransaction(
    id,
    target ? { ...draft, plannedId: target.plannedId } : draft,
  )
  await stepBackTo(before?.plannedId)
  if (target && billId) return settle(id, draft, billId, target)
  if (billId) await syncBillNextDue(billId)
  return null
}

/** Deleting a bill payment reopens its occurrence, so `nextDue` steps back to it. */
export async function removeTransaction(id: string): Promise<void> {
  const plannedId = (await db.transactions.get(id))?.plannedId
  await deleteTransaction(id)
  await stepBackTo(plannedId)
}
