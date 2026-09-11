import type { CurrencyCode } from '#/lib/currency'
import type { NodeKind } from '#/features/balances/api/types'
import type { GoalFrequency, GoalKind } from '#/features/goals/api/types'
import type {
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'

// IndexedDB indexes don't handle booleans well, so sync flags are stored as 0 | 1.
export type Flag = 0 | 1

export type LocalBalanceNode = {
  id: string
  kind: NodeKind
  parentId: string | null
  name: string
  color: string
  note: string | null
  position: number
  collapsed: boolean
  amount: number | null
  currency: CurrencyCode | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

// Single per-user settings row, stored under a constant key.
export const SETTINGS_KEY = 'me'

export type LocalBalanceSettings = {
  id: typeof SETTINGS_KEY
  baseCurrency: CurrencyCode
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
}

export type LocalExchangeRate = {
  currency: CurrencyCode
  rate: number
  version: string
  updatedAt: string
  // Per-user editable now (copy-on-write defaults): a local edit stays `dirty` until pushed,
  // so a background pull won't clobber it.
  dirty: Flag
}

export type LocalCategory = {
  id: string
  slug: string
  name: string
  type: TxType
  color: string
  position: number
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalIncomeStream = {
  id: string
  label: string
  amount: number
  currency: CurrencyCode
  frequency: GoalFrequency
  day: number
  color: string
  position: number
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalGoal = {
  id: string
  name: string
  kind: GoalKind
  currency: CurrencyCode
  color: string
  position: number
  amount: number | null
  target: number | null
  saved: number
  frequency: GoalFrequency | null
  nextDue: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

// A sourced chunk of a goal's saved progress: money reserved from a wallet (earmarked in
// place, so the wallet shows reserved vs available) or held in an external source (a label).
export type AllocationSource = 'wallet' | 'external'

export type LocalGoalAllocation = {
  id: string
  goalId: string
  source: AllocationSource
  // Set for `wallet` reserves; null for `external` (or once the wallet is deleted).
  walletId: string | null
  // Set for `external` reserves (free-text source name); null for `wallet`.
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  position: number
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalTransaction = {
  id: string
  type: TxType
  amount: number
  currency: CurrencyCode
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  date: string
  note: string | null
  source: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalBudget = {
  id: string
  scopeType: BudgetScope
  target: string | null
  period: BudgetPeriod
  customDays: number | null
  limit: number
  currency: CurrencyCode
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalRecurring = {
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
  dirty: Flag
  deleted: Flag
}

// --- Email sync (server-owned cache) -------------------------------------------------
// Email sync is inherently online (it talks to Gmail/Graph), so these rows are NOT pushed
// through the offline outbox. They're a read cache of server truth, refreshed by pulls;
// mutations call the API directly and update the cache. No dirty/deleted flags.

export type EmailProvider = 'google' | 'outlook'
export type ScanFrequency = '15m' | 'hourly' | 'daily'
export type ConnectionStatus = 'pending_setup' | 'connected'
export type ImportStatus = 'pending' | 'confirmed' | 'dismissed'

export type TrackedSender = {
  id: string
  senderEmail: string
  senderName: string | null
  defaultCategory: string | null
}

export type LocalEmailConnection = {
  id: string
  provider: EmailProvider
  email: string
  autoSync: boolean
  autoConfirm: boolean
  scanFrequency: ScanFrequency
  defaultWalletId: string | null
  status: ConnectionStatus
  lastSyncedAt: string | null
  rules: TrackedSender[]
  createdAt: string
  updatedAt: string
  version: string
}

/**
 * A cached pending import. The email body it was parsed from is deliberately not cached —
 * it is fetched per item when the user opens one for review (`emailSyncApi.getImport`).
 */
export type LocalPendingImport = {
  id: string
  connectionId: string
  merchantId: string | null
  senderEmail: string
  senderName: string | null
  subject: string | null
  emailDate: string | null
  amount: number | null
  currency: CurrencyCode | null
  suggestedMerchant: string | null
  suggestedCategory: string | null
  suggestedSubcategory: string | null
  rawPreview: string | null
  hasBody: boolean
  status: ImportStatus
  transactionId: string | null
  createdAt: string
  version: string
}

export type OutboxOp = 'create' | 'update' | 'delete'
export type OutboxEntity =
  | 'node'
  | 'settings'
  | 'income'
  | 'goal'
  | 'allocation'
  | 'transaction'
  | 'budget'
  | 'recurring'
  | 'category'
  | 'rate'

export type OutboxEntry = {
  seq?: number
  op: OutboxOp
  entity: OutboxEntity
  id: string
  payload: unknown
  baseVersion: string | null
  createdAt: string
}
