import type {
  ConnectionStatus,
  EmailProvider,
  ScanFrequency,
  TrackedSender,
} from '#/db/types'

// Re-export the domain enums so the rest of the feature imports them from one place.
export type {
  ConnectionStatus,
  EmailProvider,
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

/** One inbox the scan could not read. The rest of the scan still ran. */
export type SyncFailure = {
  connectionId: string
  code: string
}

export type SyncResult = {
  syncedConnections: number
  scannedMessages: number
  newImports: number
  autoConfirmed: number
  failures: SyncFailure[]
}

/**
 * What a caller may ask of a scan. The backend infers "manual" from any field being
 * present — an empty body is the automatic login scan, which honours `autoSync` and
 * resumes from each connection's cursor. So a deliberate scan must send at least one.
 */
export type ScanOptions = {
  connectionId?: string
  /** 1–180. Omitted means "since the last scan". */
  lookbackDays?: number
  /** 1–200 messages per connection. */
  limit?: number
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

export type AuthorizeUrlWire = { authorize_url: string; state: string }
export type SyncOptionsWire = {
  connection_id?: string
  lookback_days?: number
  limit?: number
}
export type SyncFailureWire = {
  connection_id: string
  code: string
}
export type SyncResultWire = {
  synced_connections: number
  scanned_messages: number
  new_imports: number
  auto_confirmed: number
  failures: SyncFailureWire[]
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

export const toSyncResult = (w: SyncResultWire): SyncResult => ({
  syncedConnections: w.synced_connections,
  scannedMessages: w.scanned_messages,
  newImports: w.new_imports,
  autoConfirmed: w.auto_confirmed,
  failures: w.failures.map((f) => ({
    connectionId: f.connection_id,
    code: f.code,
  })),
})

/** Undefined fields are dropped by `JSON.stringify`, so `{}` stays an automatic scan. */
export const toSyncOptionsWire = (o: ScanOptions): SyncOptionsWire => ({
  connection_id: o.connectionId,
  lookback_days: o.lookbackDays,
  limit: o.limit,
})
