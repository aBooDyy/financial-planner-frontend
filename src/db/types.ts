import type { AppConfig } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import type { NodeKind } from '#/features/wallets/api/types'
import type {
  GoalFrequency,
  GoalKind,
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import type {
  ImportSource,
  StoredTemplateConfig,
} from '#/features/import/data/types'
import type { AliasOrigin } from '#/features/merchants/api/types'
import type {
  PlannedOrigin,
  PlannedRole,
  PlannedStatus,
} from '#/features/planned/api/types'
import type {
  BudgetPeriod,
  BudgetScope,
  TransactionType,
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
  /** Icon id, or `null` for the wallet/stack default of this kind. */
  icon: string | null
  note: string | null
  position: number
  collapsed: boolean
  archivedAt: string | null
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

// The cached `GET /config` payload, under a constant key. Not user data and not synced
// through the outbox — it is a per-deploy snapshot kept so the app opens current offline.
export const APP_CONFIG_KEY = 'me'

export type LocalAppConfig = {
  id: typeof APP_CONFIG_KEY
  config: AppConfig
  fetchedAt: string
}

/**
 * A currency the user defined for themselves. Three characters like any ISO code — every
 * amount column stores a code that wide — and it carries its own `rate` (units of the
 * reference per 1 unit) because no provider quotes it.
 */
export type LocalCustomCurrency = {
  id: string
  code: CurrencyCode
  name: string
  symbol: string
  minorUnit: number
  rate: number
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalCategory = {
  id: string
  /** `null` = a top-level category; otherwise the parent category's id. */
  parentId: string | null
  slug: string
  name: string
  type: TxType
  color: string
  /** Icon id, or `null` for "use the default for my type". Narrowed at the render boundary. */
  icon: string | null
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
  /** Where the pay lands — what a planned payday confirms into. */
  walletId: string | null
  /** ISO date of a known payday; non-monthly paydays step from it. */
  anchorDate: string | null
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
  frequency: ObligationFrequency | null
  /** "Every `customInterval` `customUnit`s" — set only when `frequency` is 'custom'. */
  customInterval: number | null
  customUnit: IntervalUnit | null
  nextDue: string | null
  dueDate: string | null
  // The stored plan's header (null until the planner first generates this goal's rows).
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  /** Day of the month set-asides fall on (1–28); null reads as the 1st. */
  setAsideDay: number | null
  /** One-time obligations only: also plan the final payment on the due date. */
  payOnDue: boolean
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
  /** When it was set aside (ISO date). */
  date: string
  /** The planned set-aside this reservation settles, if any. */
  plannedId: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalTransaction = {
  id: string
  type: TransactionType
  amount: number
  currency: CurrencyCode
  /**
   * The leaf category (a subcategory's id when one was picked, else the root's); null on
   * transfer legs and adjustments.
   */
  categoryId: string | null
  walletId: string
  goalId: string | null
  merchantId: string | null
  date: string
  note: string | null
  source: string | null
  transferId: string | null
  /** The planned item this transaction settles, if any. Never set on a transfer leg. */
  plannedId: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalBudget = {
  id: string
  scopeType: BudgetScope
  /** A root category's id; set exactly when `scopeType` is 'category'. */
  categoryId: string | null
  /** Set exactly when `scopeType` is 'wallet'. */
  walletId: string | null
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
  /** The leaf category: a subcategory's id when one was picked, else the root's. */
  categoryId: string
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

// --- Planned transactions -------------------------------------------------------------
// A scheduled intention to move money on a date. Never touches balances, budgets or goal
// progress: only the transactions / reservations that settle it (via their `plannedId`) do.

export type LocalPlanned = {
  id: string
  origin: PlannedOrigin
  role: PlannedRole
  goalId: string | null
  incomeStreamId: string | null
  recurringId: string | null
  /** Suggested wallet; null means "ask at confirm". */
  walletId: string | null
  /** Display name, kept after the origin is deleted. */
  name: string
  amount: number
  currency: CurrencyCode
  /** The leaf category; null on a set-aside. */
  categoryId: string | null
  /** The date the generator assigned. Immutable — it is part of the row's identity. */
  occurrence: string
  /** When it is due now; moving it leaves `occurrence` alone. */
  date: string
  status: PlannedStatus
  /** Edited by hand, so the generator never rewrites it. */
  pinned: boolean
  note: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

// --- Merchants -----------------------------------------------------------------------
// A merchant's identity is a *set* of strings, so the aliases live in their own table and
// sync as their own entity. `normalizedKey` is produced by the shared normaliser and is
// unique per user server-side — which is what makes the adopt-and-remap branch necessary.

export type LocalMerchant = {
  id: string
  displayName: string
  /** The leaf category this merchant was last filed under. */
  learnedCategoryId: string | null
  learnedType: TxType | null
  timesSeen: number
  timesConfirmed: number
  lastSeenAt: string | null
  autoCategorize: boolean
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

export type LocalMerchantAlias = {
  id: string
  merchantId: string
  normalizedKey: string
  rawSample: string | null
  origin: AliasOrigin
  createdAt: string
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

/** One of an inbox's email rules, as the settings list shows it. */
export type EmailRuleSummary = {
  id: string
  name: string
  enabled: boolean
  senders: string[]
  walletId: string | null
  type: TxType
  autoConfirm: boolean
}

export type LocalEmailConnection = {
  id: string
  provider: EmailProvider
  email: string
  autoSync: boolean
  scanFrequency: ScanFrequency
  status: ConnectionStatus
  lastSyncedAt: string | null
  rules: EmailRuleSummary[]
  createdAt: string
  updatedAt: string
  version: string
}

// --- Integration keys (server-owned cache) --------------------------------------------
// Keys are server-minted (the secret does not exist until the server makes it), so there is
// no offline write to queue. The table is a read cache that lets the list render offline.

export type IntegrationKeyStatus = 'active' | 'revoked'

/** A webhook key's settings and usage. The secret is never here — it exists only once. */
export type LocalIntegrationKey = {
  id: string
  name: string
  tokenPrefix: string
  status: IntegrationKeyStatus
  expiresAt: string | null
  rotatedAt: string | null
  lastUsedAt: string | null
  requestsCount: number
  rateLimitPerMinute: number
  /** When a key over its quota accepts requests again; null while it is not throttled. */
  throttledUntil: string | null
  defaultWalletId: string | null
  defaultCategoryId: string | null
  defaultType: TxType
  defaultCurrency: CurrencyCode | null
  autoConfirm: boolean
  stageUnmatched: boolean
  ruleCount: number
  createdAt: string
  updatedAt: string
  version: string
}

// --- Inbound imports (server-owned cache) ---------------------------------------------
// The shared review queue: a row staged by any source (an inbox scan, a webhook) waiting for
// the user to confirm or dismiss it. A read cache of server truth: no outbox, no dirty flags.

export type ImportStatus = 'pending' | 'confirmed' | 'dismissed'
export type InboundSource = 'inbox' | 'webhook'
export type BodyFormat = 'text' | 'json'

/**
 * A cached pending import. The body it was parsed from is deliberately not cached — it is
 * fetched per item when the user opens one for review (`inboundImportsApi.getImport`).
 * At most one of `connectionId` / `keyId` is set, according to `source`: a webhook row keeps
 * neither once its key is deleted.
 */
export type LocalInboundImport = {
  id: string
  source: InboundSource
  connectionId: string | null
  keyId: string | null
  ruleId: string | null
  merchantId: string | null
  /** Inbox: the sender address. Webhook: the key's token prefix. */
  sourceRef: string | null
  /** Inbox: the sender's display name. Webhook: the key's name, kept after the key is gone. */
  sourceLabel: string | null
  subject: string | null
  occurredOn: string | null
  amount: number | null
  currency: CurrencyCode | null
  suggestedMerchant: string | null
  suggestedCategoryId: string | null
  /** What the source resolved for the entry; null when it said nothing. */
  suggestedType: TxType | null
  suggestedWalletId: string | null
  rawPreview: string | null
  hasBody: boolean
  bodyFormat: BodyFormat
  status: ImportStatus
  transactionId: string | null
  createdAt: string
  version: string
}

// --- Import (local batches, synced templates) ----------------------------------------

/**
 * One commit of imported rows — the unit the hub history lists and undo reverses. Local
 * only, never synced: the durable fact is each transaction's `source` marker, which is.
 */
export type LocalImportBatch = {
  id: string
  source: ImportSource
  label: string
  templateId: string | null
  /** Rows the file held, against `importedCount` rows actually written. */
  rowCount: number
  importedCount: number
  /** Transfers written, one per pair of legs. Absent on batches older than transfer import. */
  transferCount?: number
  skippedDuplicates: number
  errorCount: number
  walletIds: string[]
  createdAt: string
  /** Kept rather than deleted on undo, so the history keeps the fact that it happened. */
  undoneAt: string | null
}

/** A remembered mapping. Null `config` is a blob this client could not parse. */
export type LocalImportTemplate = {
  id: string
  name: string
  sourceKind: 'csv'
  signature: string
  config: StoredTemplateConfig | null
  lastUsedAt: string | null
  useCount: number
  /**
   * The server refused this name — another template of this user already holds it. Not a
   * version conflict and not retryable, so the row waits here until it is renamed.
   */
  nameConflict: Flag
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

// --- Delta sync ----------------------------------------------------------------------

/**
 * Where one entity's incremental pull resumes from, for one user. `id` is
 * `<userId>:<entity>`: the user half is what stops a sign-out whose wipe failed from
 * handing the next account a window it was never part of.
 */
export type LocalSyncWatermark = {
  id: string
  /** The server `as_of` of the last *completed* run — never a mid-run value. */
  since: string
  updatedAt: string
}

export type OutboxOp = 'create' | 'update' | 'delete'
export type OutboxEntity =
  | 'node'
  | 'settings'
  | 'income'
  | 'goal'
  | 'allocation'
  | 'transaction'
  | 'transfer'
  | 'budget'
  | 'recurring'
  | 'category'
  | 'customCurrency'
  | 'rate'
  | 'merchant'
  | 'merchantAlias'
  | 'importTemplate'
  | 'planned'

/**
 * Why the last push of an outbox entry failed. `unavailable`: the server could not be reached
 * or could not take it right now. `rejected`: the server refused this payload.
 */
export type SyncFailure = {
  kind: 'unavailable' | 'rejected'
  /** `0` for a network failure. */
  status: number
  /** The server's stable error code, e.g. `spending.transaction.wallet_invalid`. */
  code: string
  /** The field the server named, when it named one. */
  field: string | null
  /** The server's own wording, kept as the fallback for a code the app does not know. */
  message: string
  /** ISO time of the failed attempt. */
  at: string
}

export type OutboxEntry = {
  seq?: number
  op: OutboxOp
  entity: OutboxEntity
  id: string
  payload: unknown
  baseVersion: string | null
  createdAt: string
  /** Set while the last push of this payload failed; not indexed. */
  failure?: SyncFailure
  /** How many times the server has rejected it so far. */
  attempts?: number
  /** No automatic retry before this time; a manual retry ignores it. */
  nextAttemptAt?: string | null
}
