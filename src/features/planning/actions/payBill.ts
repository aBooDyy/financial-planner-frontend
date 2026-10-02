/**
 * "Pay now" on a bill: pay any open occurrence — the next one, or a later one ahead of time —
 * in full or in part. The payment settles that occurrence's planned row (made on the spot when
 * the occurrence is beyond what the planner has generated), releases what it had set aside in
 * the paying wallet, and moves `nextDue` on once the occurrence is settled. What the
 * occurrence still holds in other wallets comes back as a leftover report for the prompt.
 */
import { db } from '#/db/db'
import type { LocalBill, LocalPlanned } from '#/db/types'
import { plannedIdFor } from '#/features/planned/data/ids'
import { confirmPlanned } from '#/features/planned/data/mutations'
import { currentRates, insertPlanned } from '#/features/planned/data/rows'
import { leftoverFor } from '#/features/planning/data/leftover'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import {
  firstOpenOccurrence,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import { useSessionStore } from '#/stores/session'
import { MoneyActionError } from './errors'

export type PayBillInput = {
  /** The occurrence (due date) paid; defaults to the next open one. */
  occurrence?: string
  /** In the bill's currency; defaults to what is still open on the occurrence. */
  amount?: number
  /** Defaults to the bill's paid-from wallet. */
  walletId?: string
  /** When it was paid; defaults to today. */
  date?: string
  note?: string | null
}

export type PayBillResult = {
  transactionId: string
  occurrence: string
  /** `done` once the occurrence is paid in full; `open` after a part payment. */
  status: LocalPlanned['status']
  /** What the occurrence still holds outside the paying wallet. */
  leftover: LeftoverReport
}

async function liveBill(id: string): Promise<LocalBill> {
  const bill = await db.bills.get(id)
  if (!bill || bill.deleted !== 0) throw new MoneyActionError('not_found')
  if (bill.closedAt !== null) throw new MoneyActionError('closed')
  return bill
}

const paymentsOf = async (bill: LocalBill) =>
  paymentRowsOf(
    bill.id,
    await db.plannedTransactions.where('billId').equals(bill.id).toArray(),
  )

/** The occurrence's planned payment row, generated now under its deterministic id if missing. */
async function paymentRow(
  bill: LocalBill,
  occurrence: string,
  existing: LocalPlanned | undefined,
): Promise<LocalPlanned> {
  if (existing) return existing
  const userId = useSessionStore.getState().user?.id
  if (!userId) throw new MoneyActionError('signed_out')
  const ts = new Date().toISOString()
  const row: LocalPlanned = {
    id: plannedIdFor(userId, 'bill', bill.id, 'payment', occurrence),
    origin: 'bill',
    role: 'payment',
    goalId: null,
    incomeStreamId: null,
    billId: bill.id,
    walletId: bill.walletId,
    name: bill.name,
    amount: bill.amount,
    currency: bill.currency,
    categoryId: bill.categoryId,
    occurrence,
    date: occurrence,
    status: 'open',
    pinned: false,
    review: false,
    note: null,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await insertPlanned([row])
  return row
}

export async function payBill(
  billId: string,
  input: PayBillInput = {},
): Promise<PayBillResult> {
  const bill = await liveBill(billId)
  const payments = await paymentsOf(bill)
  const occurrence = input.occurrence ?? firstOpenOccurrence(bill, payments)
  const existing = payments.get(occurrence)
  if (existing && existing.status !== 'open')
    throw new MoneyActionError('closed')
  const walletId = input.walletId ?? bill.walletId
  if (!walletId) throw new MoneyActionError('no_wallet')

  const row = await paymentRow(bill, occurrence, existing)
  const result = await confirmPlanned(row.id, {
    amount: input.amount,
    walletId,
    date: input.date,
    note: input.note,
  })
  const [after, setAsides] = await Promise.all([
    paymentsOf(bill),
    db.setAsides.where('billId').equals(bill.id).toArray(),
  ])
  return {
    transactionId: result.settlementId,
    occurrence,
    status: result.status,
    leftover: leftoverFor({
      bill: (await db.bills.get(bill.id)) ?? bill,
      occurrence,
      payingWalletId: walletId,
      setAsides: setAsides.filter((a) => a.deleted === 0),
      payments: after,
      rates: await currentRates(),
    }),
  }
}
