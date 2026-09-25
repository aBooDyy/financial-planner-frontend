import type { LocalBudget, LocalRecurring, LocalTransaction } from '#/db/types'
import type {
  Budget,
  CreateBudgetWire,
  CreateRecurringWire,
  CreateTransactionWire,
  CreateTransferWire,
  Recurring,
  Transaction,
  UpdateBudgetWire,
  UpdateRecurringWire,
  UpdateTransactionWire,
  UpdateTransferWire,
} from '#/features/transactions/api/types'
import {
  toWireFreq,
  toWirePeriod,
  toWireScope,
  toWireTransactionType,
  toWireTxType,
} from '#/features/transactions/api/types'

// --- Transactions --------------------------------------------------------------------

export const serverTransactionToLocal = (t: Transaction): LocalTransaction => ({
  ...t,
  merchantId: t.merchantId ?? null,
  plannedId: t.plannedId ?? null,
  dirty: 0,
  deleted: 0,
})

export const localTransactionToCreateWire = (
  l: LocalTransaction,
): CreateTransactionWire => ({
  id: l.id,
  type: toWireTransactionType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  // Always sent: PATCH replaces, so omitting it would silently clear the merchant link.
  merchant_id: l.merchantId,
  date: l.date,
  note: l.note,
  source: l.source,
  // Always sent: PATCH replaces, so omitting it would unlink the settlement.
  planned_id: l.plannedId,
})

export const localTransactionToUpdateWire = (
  l: LocalTransaction,
): UpdateTransactionWire => ({
  version: l.version,
  type: toWireTransactionType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  // Always sent: PATCH replaces, so omitting it would silently clear the merchant link.
  merchant_id: l.merchantId,
  date: l.date,
  note: l.note,
  source: l.source,
  // Always sent: PATCH replaces, so omitting it would unlink the settlement.
  planned_id: l.plannedId,
})

// --- Transfers -----------------------------------------------------------------------

/** The two legs of one transfer, as held locally. */
export type TransferLegs = { out: LocalTransaction; in: LocalTransaction }

/** Whatever is left of a transfer locally — a leg goes when its wallet is deleted. */
export type HeldLegs = { out?: LocalTransaction; in?: LocalTransaction }

export const transferToCreateWire = (
  transferId: string,
  { out, in: inn }: TransferLegs,
): CreateTransferWire => ({
  id: transferId,
  out_id: out.id,
  in_id: inn.id,
  from_wallet_id: out.walletId,
  to_wallet_id: inn.walletId,
  amount: out.amount,
  // The server wants it only across currencies, and refuses a differing one within one.
  to_amount: out.currency === inn.currency ? null : inn.amount,
  date: out.date,
  note: out.note,
  source: out.source,
})

export const transferToUpdateWire = ({
  out,
  in: inn,
}: HeldLegs): UpdateTransferWire => {
  const any = (out ?? inn)!
  return {
    from_wallet_id: out?.walletId ?? null,
    to_wallet_id: inn?.walletId ?? null,
    // A lone IN leg takes `amount` as its own.
    amount: any.amount,
    to_amount: out && inn && out.currency !== inn.currency ? inn.amount : null,
    date: any.date,
    note: any.note,
    out_version: out?.version ?? null,
    in_version: inn?.version ?? null,
  }
}

// --- Budgets -------------------------------------------------------------------------

export const serverBudgetToLocal = (b: Budget): LocalBudget => ({
  ...b,
  dirty: 0,
  deleted: 0,
})

export const localBudgetToCreateWire = (l: LocalBudget): CreateBudgetWire => ({
  id: l.id,
  scope_type: toWireScope(l.scopeType),
  target: l.target,
  period: toWirePeriod(l.period),
  custom_days: l.customDays,
  limit_amount: l.limit,
  currency: l.currency,
})

export const localBudgetToUpdateWire = (l: LocalBudget): UpdateBudgetWire => ({
  version: l.version,
  scope_type: toWireScope(l.scopeType),
  target: l.target,
  period: toWirePeriod(l.period),
  custom_days: l.customDays,
  limit_amount: l.limit,
  currency: l.currency,
})

// --- Recurring -----------------------------------------------------------------------

export const serverRecurringToLocal = (r: Recurring): LocalRecurring => ({
  ...r,
  dirty: 0,
  deleted: 0,
})

export const localRecurringToCreateWire = (
  l: LocalRecurring,
): CreateRecurringWire => ({
  id: l.id,
  name: l.name,
  type: toWireTxType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  frequency: toWireFreq(l.frequency),
  next_due: l.nextDue,
  autopost: l.autopost,
})

export const localRecurringToUpdateWire = (
  l: LocalRecurring,
): UpdateRecurringWire => ({
  version: l.version,
  name: l.name,
  type: toWireTxType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  frequency: toWireFreq(l.frequency),
  next_due: l.nextDue,
  autopost: l.autopost,
})
