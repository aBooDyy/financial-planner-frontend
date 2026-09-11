import type { LocalBudget, LocalRecurring, LocalTransaction } from '#/db/types'
import type {
  Budget,
  CreateBudgetWire,
  CreateRecurringWire,
  CreateTransactionWire,
  Recurring,
  Transaction,
  UpdateBudgetWire,
  UpdateRecurringWire,
  UpdateTransactionWire,
} from '#/features/transactions/api/types'
import {
  toWireFreq,
  toWirePeriod,
  toWireScope,
  toWireTxType,
} from '#/features/transactions/api/types'

// --- Transactions --------------------------------------------------------------------

export const serverTransactionToLocal = (t: Transaction): LocalTransaction => ({
  ...t,
  dirty: 0,
  deleted: 0,
})

export const localTransactionToCreateWire = (
  l: LocalTransaction,
): CreateTransactionWire => ({
  id: l.id,
  type: toWireTxType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  date: l.date,
  note: l.note,
  source: l.source,
})

export const localTransactionToUpdateWire = (
  l: LocalTransaction,
): UpdateTransactionWire => ({
  version: l.version,
  type: toWireTxType(l.type),
  amount: l.amount,
  currency: l.currency,
  category: l.category,
  subcategory: l.subcategory,
  wallet_id: l.walletId,
  goal_id: l.goalId,
  date: l.date,
  note: l.note,
  source: l.source,
})

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
