/**
 * "Pay now" on a bill: pay any open occurrence — the next one, or a later one ahead of time —
 * in full or in part. The payment settles that occurrence's planned row (made on the spot when
 * the occurrence is beyond what the planner has generated), releases what it had set aside in
 * the paying wallet, and moves `nextDue` on once the occurrence is settled. What a settled
 * occurrence still holds comes back as a leftover report for the prompt.
 */
import { db } from '#/db/db'
import type { LocalBill, LocalPlanned, LocalSetAside } from '#/db/types'
import { plannedIdFor } from '#/features/planned/data/ids'
import {
  confirmPlanned,
  syncBillNextDue,
} from '#/features/planned/data/mutations'
import { currentRates, insertPlanned } from '#/features/planned/data/rows'
import { leftoverFor } from '#/features/planning/data/leftover'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import {
  firstOpenOccurrence,
  isSettledOccurrence,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import {
  heldInWallet,
  releaseForPayment,
} from '#/features/setAsides/data/payment'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
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
  /** What a settled occurrence still holds; empty after a part payment. */
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

/**
 * The paying wallet's own leftover, as one more line: a settled occurrence still holding money
 * there (an earlier part payment came from elsewhere) would otherwise stay set aside for good.
 */
function withPayingWallet(
  report: LeftoverReport,
  bill: LocalBill,
  setAsides: ReadonlyArray<LocalSetAside>,
  payingWalletId: string,
  rates: RatesMap,
): LeftoverReport {
  const held = heldInWallet(
    setAsides,
    { billId: bill.id, occurrence: report.occurrence },
    payingWalletId,
  )
  if (held.length === 0) return report
  const currency = held[0].currency
  const amount = held.reduce(
    (sum, a) => sum + convertMinor(a.amount, a.currency, currency, rates),
    0,
  )
  return {
    ...report,
    lines: [
      ...report.lines,
      {
        walletId: payingWalletId,
        externalLabel: null,
        amount,
        currency,
        ids: held.map((a) => a.id),
      },
    ],
    total: report.total + convertMinor(amount, currency, bill.currency, rates),
  }
}

/**
 * What the occurrence still holds after the payment landed — asked about only once the
 * occurrence is settled: until then that money is still waiting for the rest of the bill.
 */
async function leftoverAfter(
  bill: LocalBill,
  occurrence: string,
  payingWalletId: string,
): Promise<LeftoverReport> {
  const [after, rows, latest, rates] = await Promise.all([
    paymentsOf(bill),
    db.setAsides.where('billId').equals(bill.id).toArray(),
    db.bills.get(bill.id),
    currentRates(),
  ])
  const setAsides = rows.filter((a) => a.deleted === 0)
  const report = leftoverFor({
    bill: latest ?? bill,
    occurrence,
    payingWalletId,
    setAsides,
    payments: after,
    rates,
  })
  if (!isSettledOccurrence(after, occurrence))
    return { ...report, lines: [], total: 0 }
  return withPayingWallet(report, bill, setAsides, payingWalletId, rates)
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
  return {
    transactionId: result.settlementId,
    occurrence,
    status: result.status,
    leftover: await leftoverAfter(bill, occurrence, walletId),
  }
}

/** The planned payment row a bill payment written elsewhere settles. */
export type BillPaymentTarget = { plannedId: string; occurrence: string }

/**
 * The open payment row a payment recorded outside Pay now (the transaction dialog, QuickAdd)
 * settles: the row it was matched to while that is still this bill's and open, else the first
 * open occurrence's — made on the spot when the planner has not generated it.
 */
export async function billPaymentTarget(
  billId: string,
  plannedId: string | null,
): Promise<BillPaymentTarget> {
  const bill = await liveBill(billId)
  const matched = plannedId
    ? await db.plannedTransactions.get(plannedId)
    : undefined
  if (
    matched &&
    matched.deleted === 0 &&
    matched.billId === bill.id &&
    matched.role === 'payment' &&
    matched.status === 'open'
  )
    return { plannedId: matched.id, occurrence: matched.occurrence }
  const payments = await paymentsOf(bill)
  const occurrence = firstOpenOccurrence(bill, payments)
  const row = await paymentRow(bill, occurrence, payments.get(occurrence))
  return { plannedId: row.id, occurrence }
}

/**
 * What Pay now does after its transaction, for one already written with the row's
 * `plannedId`: release the occurrence's set-asides in the paying wallet, move `nextDue` on, and
 * report what a settled occurrence still holds for the leftover prompt.
 */
export async function settleBillPayment(
  billId: string,
  occurrence: string,
  payment: {
    id: string
    walletId: string
    amount: number
    currency: CurrencyCode
    date: string
  },
): Promise<LeftoverReport> {
  const bill = await liveBill(billId)
  await releaseForPayment(
    { billId: bill.id, occurrence },
    payment,
    await currentRates(),
  )
  await syncBillNextDue(bill.id)
  return leftoverAfter(bill, occurrence, payment.walletId)
}
