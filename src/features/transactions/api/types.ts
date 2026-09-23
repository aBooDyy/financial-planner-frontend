import { fromWireCurrency } from '#/lib/currency'
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

/**
 * A transfer is two ledger rows sharing a `transferId`: the OUT leg debits the source wallet,
 * the IN leg credits the destination. Only ledger rows carry these — categories, recurring
 * schedules and imports stay `TxType`.
 */
export type TransferLegType = 'transfer_out' | 'transfer_in'
export type TransferLegTypeWire = 'TRANSFER_OUT' | 'TRANSFER_IN'
export type TransactionType = TxType | TransferLegType
export type TransactionTypeWire = TxTypeWire | TransferLegTypeWire

export type BudgetScope = 'category' | 'wallet' | 'overall'
export type BudgetScopeWire = 'CATEGORY' | 'WALLET' | 'OVERALL'

export type BudgetPeriod = 'weekly' | 'monthly' | 'custom'
export type BudgetPeriodWire = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

const TX_TYPE_TO_WIRE: Record<TxType, TxTypeWire> = {
  spend: 'SPEND',
  income: 'INCOME',
}
const TRANSACTION_TYPE_TO_WIRE: Record<TransactionType, TransactionTypeWire> = {
  ...TX_TYPE_TO_WIRE,
  transfer_out: 'TRANSFER_OUT',
  transfer_in: 'TRANSFER_IN',
}
const TX_TYPE_FROM_WIRE: Record<TxTypeWire, TxType> = {
  SPEND: 'spend',
  INCOME: 'income',
}
const TRANSACTION_TYPE_FROM_WIRE: Record<TransactionTypeWire, TransactionType> =
  {
    ...TX_TYPE_FROM_WIRE,
    TRANSFER_OUT: 'transfer_out',
    TRANSFER_IN: 'transfer_in',
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
export const toWireTransactionType = (
  t: TransactionType,
): TransactionTypeWire => TRANSACTION_TYPE_TO_WIRE[t]
export const fromWireTransactionType = (
  w: TransactionTypeWire,
): TransactionType => TRANSACTION_TYPE_FROM_WIRE[w]

export const isTransferLeg = (type: TransactionType): type is TransferLegType =>
  type === 'transfer_out' || type === 'transfer_in'
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
  type: TransactionType
  amount: number // minor units, always positive
  currency: CurrencyCode
  /** Null only on transfer legs. */
  category: string | null
  subcategory: string | null
  walletId: string
  goalId: string | null
  merchantId: string | null
  date: string // ISO YYYY-MM-DD
  note: string | null
  source: string | null
  transferId: string | null
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
  type: TransactionTypeWire
  amount: number
  currency: string
  category: string | null
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  merchant_id: string | null
  date: string
  note: string | null
  source: string | null
  transfer_id: string | null
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

/** The server refuses transfer legs here (`spending.transaction.transfer_via_transfers`). */
export type CreateTransactionWire = {
  id: string
  type: TransactionTypeWire
  amount: number
  currency: string
  category: string | null
  subcategory: string | null
  wallet_id: string
  goal_id: string | null
  merchant_id: string | null
  date: string
  note: string | null
  source: string | null
}
export type UpdateTransactionWire = Omit<CreateTransactionWire, 'id'> & {
  version: string
}

/**
 * `POST /transfers`. Currencies are not sent — the server takes them from the wallets.
 * `to_amount` is required iff the two wallets' currencies differ.
 */
export type CreateTransferWire = {
  id: string
  out_id: string
  in_id: string
  from_wallet_id: string
  to_wallet_id: string
  amount: number
  to_amount: number | null
  date: string
  note: string | null
}

/**
 * `PATCH /transfers/{id}`. For a leg that no longer exists (its wallet was deleted) both its
 * wallet id and its version are null, and the server ignores that side.
 */
export type UpdateTransferWire = Omit<
  CreateTransferWire,
  'id' | 'out_id' | 'in_id' | 'from_wallet_id' | 'to_wallet_id'
> & {
  from_wallet_id: string | null
  to_wallet_id: string | null
  out_version: string | null
  in_version: string | null
}

export type TransferWire = {
  transfer_id: string
  legs: TransactionWire[]
}

export type Transfer = {
  transferId: string
  legs: Transaction[]
}

/** What became of one entry of a bulk write. The order mirrors what was sent. */
export type BulkTransactionResultWire = {
  id: string
  status: 'CREATED' | 'ID_TAKEN' | 'INVALID'
  transaction: TransactionWire | null
  error_code: string | null
  error_field: string | null
}

export type BulkCreateTransactionsWire = {
  results: BulkTransactionResultWire[]
  created: number
  failed: number
}

export type BulkTransactionResult = {
  id: string
  /**
   * `created` — written. `taken` — the id already exists, so the write already happened.
   * `invalid` — unusable as posted, and no retry of the same payload can change that.
   */
  status: 'created' | 'taken' | 'invalid'
  /** The row as the server holds it. Absent when the taken id is not the caller's own. */
  transaction: Transaction | null
  errorCode: string | null
}

/** What became of one id of a bulk delete. The order mirrors what was sent. */
export type BulkDeleteTransactionResultWire = {
  id: string
  status: 'DELETED' | 'NOT_FOUND' | 'INVALID'
  error_code: string | null
  error_field: string | null
}

export type BulkDeleteTransactionsWire = {
  results: BulkDeleteTransactionResultWire[]
  deleted: number
  failed: number
}

export type BulkDeleteResult = {
  id: string
  /**
   * `deleted` — the row is gone. `missing` — nothing of ours stood behind that id, so it
   * was already gone. `invalid` — not a usable id, and resending it cannot change that.
   * All three are terminal: there is never anything left to retry.
   */
  status: 'deleted' | 'missing' | 'invalid'
  errorCode: string | null
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
  type: fromWireTransactionType(w.type),
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  category: w.category,
  subcategory: w.subcategory,
  walletId: w.wallet_id,
  goalId: w.goal_id,
  merchantId: w.merchant_id ?? null,
  date: w.date,
  note: w.note,
  source: w.source,
  transferId: w.transfer_id,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toTransfer = (w: TransferWire): Transfer => ({
  transferId: w.transfer_id,
  legs: w.legs.map(toTransaction),
})

const BULK_STATUS = {
  CREATED: 'created',
  ID_TAKEN: 'taken',
  INVALID: 'invalid',
} as const

export const toBulkResult = (
  w: BulkTransactionResultWire,
): BulkTransactionResult => ({
  id: w.id,
  status: BULK_STATUS[w.status],
  transaction: w.transaction ? toTransaction(w.transaction) : null,
  errorCode: w.error_code,
})

const BULK_DELETE_STATUS = {
  DELETED: 'deleted',
  NOT_FOUND: 'missing',
  INVALID: 'invalid',
} as const

export const toBulkDeleteResult = (
  w: BulkDeleteTransactionResultWire,
): BulkDeleteResult => ({
  id: w.id,
  status: BULK_DELETE_STATUS[w.status],
  errorCode: w.error_code,
})

export const toBudget = (w: BudgetWire): Budget => ({
  id: w.id,
  scopeType: fromWireScope(w.scope_type),
  target: w.target,
  period: fromWirePeriod(w.period),
  customDays: w.custom_days,
  limit: w.limit_amount,
  currency: fromWireCurrency(w.currency),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toRecurring = (w: RecurringWire): Recurring => ({
  id: w.id,
  name: w.name,
  type: fromWireTxType(w.type),
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
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
