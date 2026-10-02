/**
 * Saving a spend from the transaction dialog or QuickAdd. One that pays a bill takes the same
 * path as Pay now (03 §5): it settles the occurrence's planned payment, releases what that
 * occurrence had set aside in the paying wallet, moves the bill's `nextDue` on, and hands back
 * what other wallets still hold so the leftover prompt can ask about it. One spent from a goal
 * releases the goal's set-asides in the paying wallet, as Use it does. Deleting, unlinking or
 * re-pricing either first gives back what it released (`planning/actions/paymentUndo`).
 */
import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import { syncBillNextDue } from '#/features/planned/data/mutations'
import { currentRates } from '#/features/planned/data/rows'
import {
  billPaymentTarget,
  settleBillPayment,
} from '#/features/planning/actions/payBill'
import type { BillPaymentTarget } from '#/features/planning/actions/payBill'
import { MoneyActionError } from '#/features/planning/actions/errors'
import {
  restoreReleasedBy,
  stepNextDueBack,
} from '#/features/planning/actions/paymentUndo'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import { releaseForPayment } from '#/features/setAsides/data/payment'
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

const goalOf = (draft: TransactionDraft): string | null =>
  draft.type === 'spend' && !draft.billId ? draft.goalId : null

/** A spend from a goal releases the goal's set-asides in the paying wallet (03 §5). */
async function releaseForGoal(
  id: string,
  draft: TransactionDraft,
  goalId: string,
): Promise<void> {
  await releaseForPayment(
    { goalId },
    {
      id,
      walletId: draft.walletId,
      amount: draft.amount,
      currency: draft.currency,
      date: draft.date,
    },
    await currentRates(),
  )
}

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

/** Release for the payment and report the leftover; a bill closed meanwhile is left alone. */
async function settle(
  id: string,
  draft: TransactionDraft,
  billId: string,
  target: BillPaymentTarget,
): Promise<LeftoverPrompt | null> {
  let report: LeftoverReport
  try {
    report = await settleBillPayment(billId, target.occurrence, {
      id,
      walletId: draft.walletId,
      amount: draft.amount,
      currency: draft.currency,
      date: draft.date,
    })
  } catch (err) {
    if (err instanceof MoneyActionError) return null
    throw err
  }
  return report.lines.length > 0
    ? { report, payingWalletId: draft.walletId, date: draft.date }
    : null
}

/** The row an unchanged link settles, to release for it again after a re-pricing edit. */
async function sameTarget(
  plannedId: string | null,
): Promise<BillPaymentTarget | null> {
  const row = plannedId ? await db.plannedTransactions.get(plannedId) : null
  return row && row.deleted === 0
    ? { plannedId: row.id, occurrence: row.occurrence }
    : null
}

/** What a payment released depends on these; an edit of any of them releases afresh. */
const movesMoney = (before: LocalTransaction, draft: TransactionDraft) =>
  before.type !== draft.type ||
  before.amount !== draft.amount ||
  before.currency !== draft.currency ||
  before.walletId !== draft.walletId

/** A new spend or income entry. A bill payment comes back with its leftover prompt, if any. */
export async function saveNewTransaction(
  draft: TransactionDraft,
): Promise<LeftoverPrompt | null> {
  const billId = billOf(draft)
  const target = billId
    ? await targetFor(billId, draft.plannedId ?? null)
    : null
  if (!billId || !target) {
    const id = await createTransaction(draft)
    const goalId = goalOf(draft)
    if (goalId) await releaseForGoal(id, draft, goalId)
    return null
  }
  const id = await createTransaction({ ...draft, plannedId: target.plannedId })
  return settle(id, draft, billId, target)
}

/**
 * An edited entry. One newly linked to a bill is paid like a new payment. A change of link
 * (bill or goal), amount or wallet first gives back what the payment released, then releases
 * again for what it is now; otherwise the bill's `nextDue` is only brought back in line with
 * what is settled.
 */
export async function saveTransactionEdit(
  id: string,
  draft: TransactionDraft,
): Promise<LeftoverPrompt | null> {
  const before = await db.transactions.get(id)
  // Mirrors `updateTransaction`: an undefined link leaves the stored one alone.
  const billId =
    draft.type !== 'spend'
      ? null
      : draft.billId !== undefined
        ? draft.billId
        : (before?.billId ?? null)
  const sameLink =
    before !== undefined &&
    (before.billId ?? null) === billId &&
    (draft.plannedId === undefined || before.plannedId === draft.plannedId)
  const repriced = before !== undefined && movesMoney(before, draft)
  const goalId = goalOf(draft)
  const sameGoal = before !== undefined && before.goalId === draft.goalId
  const target =
    billId && draft.type === 'spend' && !sameLink
      ? await targetFor(billId, draft.plannedId ?? null)
      : null

  if (!sameLink || !sameGoal || repriced) await restoreReleasedBy([id])
  await updateTransaction(
    id,
    target ? { ...draft, plannedId: target.plannedId } : draft,
  )
  await stepNextDueBack([before?.plannedId])
  if (goalId && (!sameGoal || repriced)) await releaseForGoal(id, draft, goalId)
  if (target && billId) return settle(id, draft, billId, target)
  const again =
    billId && draft.type === 'spend' && repriced
      ? await sameTarget(before.plannedId)
      : null
  if (again && billId) return settle(id, draft, billId, again)
  if (billId) await syncBillNextDue(billId)
  return null
}

/**
 * Deleting a payment gives back what it released and reopens its occurrence, so `nextDue`
 * steps back to it.
 */
export async function removeTransaction(id: string): Promise<void> {
  const plannedId = (await db.transactions.get(id))?.plannedId
  await restoreReleasedBy([id])
  await deleteTransaction(id)
  await stepNextDueBack([plannedId])
}
