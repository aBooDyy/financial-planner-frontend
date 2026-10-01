import type { AppConfig } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import type {
  NodeKind,
  PaydayMode,
  SafeHorizon,
} from '#/features/wallets/api/types'
import type {
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import type { SetAsideSource } from '#/features/setAsides/api/types'
import type {
  ImportSource,
  StoredTemplateConfig,
} from '#/features/import/data/types'
import type { AliasOrigin } from '#/features/merchants/api/types'
import type { SpendClass } from '#/features/categories/api/types'
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

/**
 * The per-user settings row: the base currency plus the planning settings. The planning
 * fields are optional because rows stored before they existed lack them; read them through
 * `planningSettingsOf`, which fills the defaults.
 */
export type LocalBalanceSettings = {
  id: typeof SETTINGS_KEY
  baseCurrency: CurrencyCode
  safeHorizon?: SafeHorizon
  safeHorizonDays?: number | null
  paydayMode?: PaydayMode
  mainIncomeStreamId?: string | null
  incomeVaries?: boolean
  incomeFloor?: number | null
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
  /**
   * Spend categories only. `null` on a subcategory inherits its root's; on a root, not sorted.
   * Rows stored before the field existed lack it, which reads as `null`.
   */
  spendClass?: SpendClass | null
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
  frequency: ObligationFrequency
  /** "Every `customInterval` `customUnit`s" — set exactly when `frequency` is 'custom'. */
  customInterval: number | null
  customUnit: IntervalUnit | null
  day: number
  /** ISO date of a known payday; non-monthly paydays step from it. */
  anchorDate: string | null
  /** The last payday; null pays forever. */
  endsOn: string | null
  color: string
  position: number
  /** Where the pay lands — what a planned payday confirms into. */
  walletId: string | null
  /** An income category; a payday confirms under it. */
  categoryId: string
  merchantId: string | null
  /** "Log it automatically when it arrives". */
  autolog: boolean
  note: string | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

/**
 * Something the user is saving for. Its shape follows from which fields are set (target +
 * date, target + monthly amount, monthly amount alone); saved progress is derived from its
 * set-asides and the spending linked to it, never stored.
 */
export type LocalGoal = {
  id: string
  name: string
  currency: CurrencyCode
  color: string
  position: number
  target: number | null
  /** Monthly amount; required when there is no `dueDate`. */
  amount: number | null
  dueDate: string | null
  mustHave: boolean
  /** Where its set-asides go by default. */
  saveWalletId: string | null
  /** The spend category "Use it" files under. */
  useCategoryId: string | null
  /** Marked as done. Only the close / reopen actions move it. */
  closedAt: string | null
  /** Paused: no planned set-asides while set. Only pause / resume (and close) move it. */
  pausedAt: string | null
  // The stored plan's header (null until the planner first generates this goal's rows).
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  /** Day of the month set-asides fall on (1–28); null reads as the 1st. */
  setAsideDay: number | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

/** Something the user has to pay, once (`frequency: null`) or on a schedule. */
export type LocalBill = {
  id: string
  name: string
  /** Per occurrence; 0 when the amount is not known yet. */
  amount: number
  currency: CurrencyCode
  /** Null = "Just once": `nextDue` is its only occurrence. */
  frequency: ObligationFrequency | null
  /** "Every `customInterval` `customUnit`s" — set exactly when `frequency` is 'custom'. */
  customInterval: number | null
  customUnit: IntervalUnit | null
  /** The next open occurrence; the client moves it on as occurrences settle. */
  nextDue: string
  /** Repeating bills only: the last date an occurrence may fall on. */
  endsOn: string | null
  /** "Paid from"; null = decide when paying. */
  walletId: string | null
  /** "Save in"; null = the paid-from wallet. */
  saveWalletId: string | null
  /** The leaf spend category. */
  categoryId: string
  merchantId: string | null
  note: string | null
  /** "Log it automatically on the due date". */
  autopay: boolean
  /** False = "Nice to have". */
  mustPay: boolean
  color: string
  position: number
  /** Marked as done / ended. Only the close / reopen actions move it. */
  closedAt: string | null
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
  setAsideDay: number | null
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

/**
 * Money labelled for one bill or one goal, in its real wallet (or held outside, named by a
 * label). It never moves money. Live while `releasedAt` is null; a row is wholly live or
 * wholly released — a partial release splits it.
 */
export type LocalSetAside = {
  id: string
  goalId: string | null
  billId: string | null
  /** A bill's: the due date of the occurrence it covers. Null for a goal. */
  occurrence: string | null
  source: SetAsideSource
  /** `wallet` only; null once that wallet was deleted. */
  walletId: string | null
  /** `outside` only: where the money is held. */
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  position: number
  /** When it was set aside (ISO date). */
  date: string
  /** The planned set-aside it settles, if any. */
  plannedId: string | null
  releasedAt: string | null
  /** The payment (transaction) that released it. */
  releasedById: string | null
  /** The transfer a move rode on, on both the released row and the new one. */
  movedByTransferId: string | null
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
  /** Money used from this goal. Never with `billId`. */
  goalId: string | null
  /**
   * A payment for this bill. Never with `goalId`, never on a transfer leg or adjustment. Rows
   * stored before bills existed lack it, which reads as null.
   */
  billId?: string | null
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

export type LedgerTotalKind = 'wallet' | 'category' | 'merchant' | 'currency'

/**
 * A running aggregate over `transactions`, derived and device-local: never synced, rebuilt
 * from the ledger whenever it is in doubt.
 */
export type LocalLedgerTotal = {
  id: string
  kind: LedgerTotalKind
  /** The wallet, category or merchant id, or the currency code. */
  ref: string
  /** On a wallet total, the currency its rows are in; null on every other kind. */
  currency: CurrencyCode | null
  /** Signed minor units in `currency`; 0 on every kind but wallet. */
  sum: number
  count: number
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
  /**
   * "Leave out planned bills": payments for a bill don't count against it. Rows stored before
   * the field existed lack it, which reads as off.
   */
  excludesBills?: boolean
  createdAt: string
  updatedAt: string
  version: string
  dirty: Flag
  deleted: Flag
}

// --- Planned transactions -------------------------------------------------------------
// A scheduled intention to move money on a date. Never touches balances, budgets or goal
// progress: only the transactions / set-asides that settle it (via their `plannedId`) do.

export type LocalPlanned = {
  id: string
  origin: PlannedOrigin
  role: PlannedRole
  goalId: string | null
  incomeStreamId: string | null
  billId: string | null
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
  /** A payday set-aside waiting in the review queue. */
  review: boolean
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
  skippable: boolean
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
  | 'bill'
  | 'setAside'
  | 'transaction'
  | 'transfer'
  | 'budget'
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
