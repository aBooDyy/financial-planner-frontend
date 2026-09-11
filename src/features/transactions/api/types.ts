import type { CurrencyCode } from '#/lib/currency'
import type {
  GoalFrequency,
  GoalFrequencyWire,
} from '#/features/goals/api/types'
import { fromWireFreq, toWireFreq } from '#/features/goals/api/types'

/**
 * Internal representation stays lowercase (nice for UI/logic); the wire is the backend's
 * PersistedEnum UPPER_SNAKE name. Translate only at the wire boundary (mappers below).
 * Recurring cadence reuses the Goals `GoalFrequency` (same backend `Frequency` enum).
 */
export type TxType = 'spend' | 'income'
export type TxTypeWire = 'SPEND' | 'INCOME'

export type BudgetScope = 'category' | 'wallet' | 'overall'
export type BudgetScopeWire = 'CATEGORY' | 'WALLET' | 'OVERALL'

export type BudgetPeriod = 'weekly' | 'monthly' | 'custom'
export type BudgetPeriodWire = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

const TX_TYPE_TO_WIRE: Record<TxType, TxTypeWire> = {
  spend: 'SPEND',
  income: 'INCOME',
}
const TX_TYPE_FROM_WIRE: Record<TxTypeWire, TxType> = {
  SPEND: 'spend',
  INCOME: 'income',
}
const SCOPE_TO_WIRE: Record<BudgetScope, BudgetScopeWire> = {
  category: 'CATEGORY',
  wallet: 'WALLET',
  overall: 'OVERALL',
}
const SCOPE_FROM_WIRE: Record<BudgetScopeWire, BudgetScope> = {
  CATEGORY: 'category',
  WALLET: 'wallet',
  OVERALL: 'overall',
}
const PERIOD_TO_WIRE: Record<BudgetPeriod, BudgetPeriodWire> = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  custom: 'CUSTOM',
}
const PERIOD_FROM_WIRE: Record<BudgetPeriodWire, BudgetPeriod> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
}

export const toWireTxType = (t: TxType): TxTypeWire => TX_TYPE_TO_WIRE[t]
export const fromWireTxType = (w: TxTypeWire): TxType => TX_TYPE_FROM_WIRE[w]
export const toWireScope = (s: BudgetScope): BudgetScopeWire => SCOPE_TO_WIRE[s]
export const fromWireScope = (w: BudgetScopeWire): BudgetScope =>
  SCOPE_FROM_WIRE[w]
export const toWirePeriod = (p: BudgetPeriod): BudgetPeriodWire =>
  PERIOD_TO_WIRE[p]
export const fromWirePeriod = (w: BudgetPeriodWire): BudgetPeriod =>
  PERIOD_FROM_WIRE[w]

// --- Domain types (camelCase) --------------------------------------------------------

export type Transaction = {
  id: string
  type: TxType
  amount: number // minor units, always positive
  currency: CurrencyCode
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  date: string // ISO YYYY-MM-DD
  note: string | null
  source: string | null
  createdAt: string
  updatedAt: string
  version: string
}

export type Budget = {
  id: string
  scopeType: BudgetScope
  target: string | null // category slug or wallet id; null for overall
  period: BudgetPeriod
  customDays: number | null
  limit: number // minor units
  currency: CurrencyCode
  createdAt: string
  updatedAt: string
  version: string
}

export type Recurring = {
  id: string
  name: string
  type: TxType
  amount: number
  currency: CurrencyCode
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  frequency: GoalFrequency
  nextDue: string
  autopost: boolean
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire types (snake_case) ---------------------------------------------------------

export type TransactionWire = {
  id: string
  type: TxTypeWire
  amount: number
  currency: string
  category: string
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  date: string
  note: string | null
  source: string | null
  created_at: string
  updated_at: string
  version: string
}

export type BudgetWire = {
  id: string
  scope_type: BudgetScopeWire
  target: string | null
  period: BudgetPeriodWire
  custom_days: number | null
  limit_amount: number
  currency: string
  created_at: string
  updated_at: string
  version: string
}

export type RecurringWire = {
  id: string
  name: string
  type: TxTypeWire
  amount: number
  currency: string
  category: string
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  frequency: GoalFrequencyWire
  next_due: string
  autopost: boolean
  created_at: string
  updated_at: string
  version: string
}

export type CreateTransactionWire = {
  id: string
  type: TxTypeWire
  amount: number
  currency: string
  category: string
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  date: string
  note: string | null
  source: string | null
}
export type UpdateTransactionWire = Omit<CreateTransactionWire, 'id'> & {
  version: string
}

export type CreateBudgetWire = {
  id: string
  scope_type: BudgetScopeWire
  target: string | null
  period: BudgetPeriodWire
  custom_days: number | null
  limit_amount: number
  currency: string
}
export type UpdateBudgetWire = Omit<CreateBudgetWire, 'id'> & {
  version: string
}

export type CreateRecurringWire = {
  id: string
  name: string
  type: TxTypeWire
  amount: number
  currency: string
  category: string
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  frequency: GoalFrequencyWire
  next_due: string
  autopost: boolean
}
export type UpdateRecurringWire = Omit<CreateRecurringWire, 'id'> & {
  version: string
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toTransaction = (w: TransactionWire): Transaction => ({
  id: w.id,
  type: fromWireTxType(w.type),
  amount: w.amount,
  currency: w.currency as CurrencyCode,
  category: w.category,
  subcategory: w.subcategory,
  walletId: w.wallet_id,
  goalId: w.goal_id,
  date: w.date,
  note: w.note,
  source: w.source,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toBudget = (w: BudgetWire): Budget => ({
  id: w.id,
  scopeType: fromWireScope(w.scope_type),
  target: w.target,
  period: fromWirePeriod(w.period),
  customDays: w.custom_days,
  limit: w.limit_amount,
  currency: w.currency as CurrencyCode,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toRecurring = (w: RecurringWire): Recurring => ({
  id: w.id,
  name: w.name,
  type: fromWireTxType(w.type),
  amount: w.amount,
  currency: w.currency as CurrencyCode,
  category: w.category,
  subcategory: w.subcategory,
  walletId: w.wallet_id,
  goalId: w.goal_id,
  frequency: fromWireFreq(w.frequency),
  nextDue: w.next_due,
  autopost: w.autopost,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export { toWireFreq, fromWireFreq }
