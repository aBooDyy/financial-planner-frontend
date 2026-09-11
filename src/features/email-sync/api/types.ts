import type {
  ConnectionStatus,
  EmailProvider,
  ImportStatus,
  ScanFrequency,
  TrackedSender,
} from '#/db/types'
import type {
  Transaction,
  TransactionWire,
} from '#/features/transactions/api/types'
import { toTransaction } from '#/features/transactions/api/types'

// Re-export the domain enums so the rest of the feature imports them from one place.
export type {
  ConnectionStatus,
  EmailProvider,
  ImportStatus,
  ScanFrequency,
  TrackedSender,
} from '#/db/types'

/**
 * Internal representation stays lowercase; the wire is the backend's PersistedEnum
 * UPPER_SNAKE name. Translate only at this boundary. Email-sync entities are server-owned
 * (online feature), so there are no create/update *local* drafts pushed via the outbox —
 * just request payloads the API layer sends directly.
 */
export type EmailProviderWire = 'GOOGLE' | 'OUTLOOK'
export type ScanFrequencyWire = 'FIFTEEN_MIN' | 'HOURLY' | 'DAILY'
export type ConnectionStatusWire = 'PENDING_SETUP' | 'CONNECTED'
export type ImportStatusWire = 'PENDING' | 'CONFIRMED' | 'DISMISSED'

const PROVIDER_TO_WIRE: Record<EmailProvider, EmailProviderWire> = {
  google: 'GOOGLE',
  outlook: 'OUTLOOK',
}
const PROVIDER_FROM_WIRE: Record<EmailProviderWire, EmailProvider> = {
  GOOGLE: 'google',
  OUTLOOK: 'outlook',
}
const FREQ_TO_WIRE: Record<ScanFrequency, ScanFrequencyWire> = {
  '15m': 'FIFTEEN_MIN',
  hourly: 'HOURLY',
  daily: 'DAILY',
}
const FREQ_FROM_WIRE: Record<ScanFrequencyWire, ScanFrequency> = {
  FIFTEEN_MIN: '15m',
  HOURLY: 'hourly',
  DAILY: 'daily',
}
const STATUS_FROM_WIRE: Record<ConnectionStatusWire, ConnectionStatus> = {
  PENDING_SETUP: 'pending_setup',
  CONNECTED: 'connected',
}
const IMPORT_STATUS_FROM_WIRE: Record<ImportStatusWire, ImportStatus> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DISMISSED: 'dismissed',
}

export const toWireProvider = (p: EmailProvider): EmailProviderWire =>
  PROVIDER_TO_WIRE[p]
export const fromWireProvider = (w: EmailProviderWire): EmailProvider =>
  PROVIDER_FROM_WIRE[w]
export const toWireFrequency = (f: ScanFrequency): ScanFrequencyWire =>
  FREQ_TO_WIRE[f]
export const fromWireFrequency = (w: ScanFrequencyWire): ScanFrequency =>
  FREQ_FROM_WIRE[w]
export const fromWireStatus = (w: ConnectionStatusWire): ConnectionStatus =>
  STATUS_FROM_WIRE[w]
export const fromWireImportStatus = (w: ImportStatusWire): ImportStatus =>
  IMPORT_STATUS_FROM_WIRE[w]

// --- Domain types --------------------------------------------------------------------

export type EmailConnection = {
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

export type InboxMessage = {
  id: string
  senderEmail: string
  senderName: string | null
  subject: string
  date: string | null
  bodyLines: string[]
  preview: string
  likely: boolean
}

export type PendingImport = {
  id: string
  connectionId: string
  merchantId: string | null
  senderEmail: string
  senderName: string | null
  subject: string | null
  emailDate: string | null
  amount: number | null
  currency: string | null
  suggestedMerchant: string | null
  suggestedCategory: string | null
  suggestedSubcategory: string | null
  rawPreview: string | null
  /** Whether the stored email body can be fetched (false for pre-0009 rows). */
  hasBody: boolean
  status: ImportStatus
  transactionId: string | null
  createdAt: string
  version: string
}

/** What the user has taught the app about a merchant — shown as context while reviewing. */
export type ImportMerchant = {
  id: string
  displayName: string
  learnedCategory: string | null
  learnedSubcategory: string | null
  timesSeen: number
  timesConfirmed: number
}

/** One import plus the email it came from — the review screen reads its values off this. */
export type ImportDetail = {
  import: PendingImport
  bodyLines: string[]
  bodyTruncated: boolean
  merchant: ImportMerchant | null
}

export type SyncResult = {
  syncedConnections: number
  newImports: number
  autoConfirmed: number
}

// --- Wire types ----------------------------------------------------------------------

export type TrackedSenderWire = {
  id: string
  sender_email: string
  sender_name: string | null
  default_category: string | null
}

export type ConnectionWire = {
  id: string
  provider: EmailProviderWire
  email_address: string
  auto_sync: boolean
  auto_confirm: boolean
  scan_frequency: ScanFrequencyWire
  default_wallet_id: string | null
  status: ConnectionStatusWire
  last_synced_at: string | null
  rules: TrackedSenderWire[]
  created_at: string
  updated_at: string
  version: string
}

export type MessageWire = {
  id: string
  sender_email: string
  sender_name: string | null
  subject: string
  date: string | null
  body_lines: string[]
  preview: string
  likely: boolean
}

export type ImportWire = {
  id: string
  connection_id: string
  rule_id: string | null
  transaction_id: string | null
  merchant_id: string | null
  sender_email: string
  sender_name: string | null
  subject: string | null
  email_date: string | null
  amount: number | null
  currency: string | null
  suggested_merchant: string | null
  suggested_category: string | null
  suggested_subcategory: string | null
  raw_preview: string | null
  has_body: boolean
  status: ImportStatusWire
  created_at: string
  version: string
}

export type ImportMerchantWire = {
  id: string
  display_name: string
  learned_category: string | null
  learned_subcategory: string | null
  times_seen: number
  times_confirmed: number
}

export type ImportDetailWire = {
  email_import: ImportWire
  body_lines: string[]
  body_truncated: boolean
  merchant: ImportMerchantWire | null
}

/**
 * Confirm payload. The value fields are optional overrides — the only way to promote an
 * import whose parse came back empty, typed by the user off the stored email body.
 */
export type ConfirmImportWire = {
  wallet_id: string
  category: string
  subcategory: string | null
  type: 'SPEND' | 'INCOME'
  amount?: number
  currency?: string
  date?: string
  merchant?: string
  note?: string
}

export type AuthorizeUrlWire = { authorize_url: string; state: string }
export type SyncResultWire = {
  synced_connections: number
  new_imports: number
  auto_confirmed: number
}
export type ConfirmResultWire = {
  transaction: TransactionWire
  email_import: ImportWire
}

export type RuleDraftWire = {
  sender_email: string
  sender_name: string | null
  body_lines: string[]
  amount_index: number
  currency_index: number
  /** Optional third pick: the line naming who was paid. Null falls back to the server's
   * label heuristic. */
  merchant_index: number | null
  default_category: string | null
}

export type UpdateConnectionWire = {
  version: string
  auto_sync: boolean
  auto_confirm: boolean
  scan_frequency: ScanFrequencyWire
  default_wallet_id: string | null
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toConnection = (w: ConnectionWire): EmailConnection => ({
  id: w.id,
  provider: fromWireProvider(w.provider),
  email: w.email_address,
  autoSync: w.auto_sync,
  autoConfirm: w.auto_confirm,
  scanFrequency: fromWireFrequency(w.scan_frequency),
  defaultWalletId: w.default_wallet_id,
  status: fromWireStatus(w.status),
  lastSyncedAt: w.last_synced_at,
  rules: w.rules.map((r) => ({
    id: r.id,
    senderEmail: r.sender_email,
    senderName: r.sender_name,
    defaultCategory: r.default_category,
  })),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toMessage = (w: MessageWire): InboxMessage => ({
  id: w.id,
  senderEmail: w.sender_email,
  senderName: w.sender_name,
  subject: w.subject,
  date: w.date,
  bodyLines: w.body_lines,
  preview: w.preview,
  likely: w.likely,
})

export const toImport = (w: ImportWire): PendingImport => ({
  id: w.id,
  connectionId: w.connection_id,
  merchantId: w.merchant_id,
  senderEmail: w.sender_email,
  senderName: w.sender_name,
  subject: w.subject,
  emailDate: w.email_date,
  amount: w.amount,
  currency: w.currency,
  suggestedMerchant: w.suggested_merchant,
  suggestedCategory: w.suggested_category,
  suggestedSubcategory: w.suggested_subcategory,
  rawPreview: w.raw_preview,
  hasBody: w.has_body,
  status: fromWireImportStatus(w.status),
  transactionId: w.transaction_id,
  createdAt: w.created_at,
  version: w.version,
})

export const toImportMerchant = (w: ImportMerchantWire): ImportMerchant => ({
  id: w.id,
  displayName: w.display_name,
  learnedCategory: w.learned_category,
  learnedSubcategory: w.learned_subcategory,
  timesSeen: w.times_seen,
  timesConfirmed: w.times_confirmed,
})

export const toImportDetail = (w: ImportDetailWire): ImportDetail => ({
  import: toImport(w.email_import),
  bodyLines: w.body_lines,
  bodyTruncated: w.body_truncated,
  merchant: w.merchant ? toImportMerchant(w.merchant) : null,
})

export const toSyncResult = (w: SyncResultWire): SyncResult => ({
  syncedConnections: w.synced_connections,
  newImports: w.new_imports,
  autoConfirmed: w.auto_confirmed,
})

export type ConfirmResult = { transaction: Transaction; import: PendingImport }
export const toConfirmResult = (w: ConfirmResultWire): ConfirmResult => ({
  transaction: toTransaction(w.transaction),
  import: toImport(w.email_import),
})
