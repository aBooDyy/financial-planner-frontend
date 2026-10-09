import type {
  ConnectionStatus,
  EmailProvider,
  EmailRuleSummary,
  ScanFrequency,
} from '#/db/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'
import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import type {
  Extraction,
  ExtractionTemplate,
  ExtractionWire,
  FieldPicksWire,
  Learned,
  LearnedWire,
  LearnOptionsWire,
  LearnRequest as TemplateLearnRequest,
  TemplateWire,
} from '#/features/text-templates/api/types'
import {
  toExtraction,
  toLearned,
  toLearnOptionsWire,
  toPicksWire,
  toTemplate,
  toTemplateWire,
} from '#/features/text-templates/api/types'

// Re-export the domain enums and the template types so the rest of the feature imports them
// from one place.
export type {
  ConnectionStatus,
  EmailProvider,
  EmailRuleSummary,
  ScanFrequency,
} from '#/db/types'
export type {
  AmountSpec,
  CurrencyMode,
  CurrencySpec,
  DecimalStyle,
  ExtractField,
  Extraction,
  ExtractionTemplate,
  FieldPick,
  FieldPicks,
  FieldReading,
  LabelSource,
  LearnedLabel,
  LearnedLabels,
  LearnOptions,
  ReadingStatus,
  TemplateLabel,
  ExtractionWire,
  TemplateWire,
} from '#/features/text-templates/api/types'
export {
  toExtraction,
  toTemplate,
  toTemplateWire,
} from '#/features/text-templates/api/types'

/**
 * Internal representation stays lowercase; the wire is the backend's UPPER_SNAKE name.
 * Translate only at this boundary. Email-sync entities are server-owned (online feature), so
 * there are no local drafts pushed via the outbox — just request payloads sent directly.
 */
export type EmailProviderWire = 'GOOGLE' | 'OUTLOOK'
export type ScanFrequencyWire = 'FIFTEEN_MIN' | 'HOURLY' | 'DAILY'
export type ConnectionStatusWire =
  | 'PENDING_SETUP'
  | 'CONNECTED'
  | 'NEEDS_REAUTH'
export type WouldWire = 'STAGE' | 'POST' | 'IGNORE'

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
  NEEDS_REAUTH: 'needs_reauth',
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

const lower = <T extends string>(w: string): T => w.toLowerCase() as T

// --- Domain types --------------------------------------------------------------------

export type EmailConnection = {
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

/** The connection's own settings — rules are a separate document. */
export type ConnectionSettings = {
  autoSync: boolean
  scanFrequency: ScanFrequency
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
  /** Messages sharing a template (identical or similar) share this id. */
  groupId: string
}

/** One email as the learner and the tester read it. */
export type EmailSample = {
  id?: string
  senderEmail: string
  senderName?: string | null
  subject: string
  bodyLines: string[]
}

export type RuleFilter = {
  senders: string[]
  subjectAny: string[]
  bodyAny: string[]
  excludeAny: string[]
}

export type EmailRule = {
  id: string
  position: number
  name: string
  enabled: boolean
  filter: RuleFilter
  template: ExtractionTemplate
  walletId: string | null
  type: TxType
  categoryId: string | null
  /** Filed as the merchant when an email names none. */
  defaultMerchant: string | null
  autoConfirm: boolean
  createdAt: string
  updatedAt: string
  version: string
}

export type EmailRuleSet = { version: string; rules: EmailRule[] }

/** A rule as a save or a test sends it; no id means a new rule. */
export type EmailRuleDraft = {
  id: string | null
  name: string
  enabled: boolean
  filter: RuleFilter
  template: ExtractionTemplate
  walletId: string | null
  type: TxType
  categoryId: string | null
  defaultMerchant: string | null
  autoConfirm: boolean
}

export type LearnRequest = TemplateLearnRequest<EmailSample>

export type LearnResult = Learned & {
  similar: Extraction[]
  suggestedFilter: RuleFilter
}

export type Would = 'stage' | 'post' | 'ignore'

export type SampleVerdict = {
  sampleId: string | null
  matchedIndex: number | null
  matchedRuleId: string | null
  extraction: Extraction | null
  focus: { matched: boolean; extraction: Extraction } | null
  would: Would
}

/** One inbox the scan could not read. The rest of the scan still ran. */
export type SyncFailure = {
  connectionId: string
  code: string
}

export type ConnectionSyncResult = {
  connectionId: string
  scannedMessages: number
  newImports: number
  autoConfirmed: number
  ignored: number
  /** False when the inbox held more than one scan reads — scan again to catch up. */
  complete: boolean
}

export type SyncResult = {
  syncedConnections: number
  scannedMessages: number
  newImports: number
  autoConfirmed: number
  ignored: number
  failures: SyncFailure[]
  connections: ConnectionSyncResult[]
}

/**
 * What a caller may ask of a scan. The backend infers "manual" from any field being
 * present — an empty body is the automatic login scan, which honours `autoSync` and
 * resumes from each connection's cursor. So a deliberate scan must send at least one.
 */
export type ScanOptions = {
  connectionId?: string
  /** 1–180. Omitted means "since the last sync". */
  lookbackDays?: number
  /** 1–200 messages per connection. */
  limit?: number
}

// --- Wire types ----------------------------------------------------------------------

export type RuleSummaryWire = {
  id: string
  name: string
  enabled: boolean
  senders: string[]
  wallet_id: string | null
  type: TxTypeWire
  auto_confirm: boolean
}

export type ConnectionWire = {
  id: string
  provider: EmailProviderWire
  email_address: string
  auto_sync: boolean
  scan_frequency: ScanFrequencyWire
  status: ConnectionStatusWire
  last_synced_at: string | null
  rules: RuleSummaryWire[]
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
  group_id: string
}

export type EmailSampleWire = {
  id?: string
  sender_email: string
  sender_name?: string | null
  subject: string
  body_lines: string[]
}

export type RuleFilterWire = {
  senders: string[]
  subject_any: string[]
  body_any: string[]
  exclude_any: string[]
}

export type EmailRuleWire = {
  id: string
  position: number
  name: string
  enabled: boolean
  filter: RuleFilterWire
  template: TemplateWire
  wallet_id: string | null
  type: TxTypeWire
  category_id: string | null
  default_merchant?: string | null
  auto_confirm: boolean
  created_at: string
  updated_at: string
  version: string
}

export type EmailRuleSetWire = { version: string; rules: EmailRuleWire[] }

export type EmailRuleDraftWire = {
  id?: string
  name: string
  enabled: boolean
  filter: RuleFilterWire
  template: TemplateWire
  wallet_id: string | null
  type: TxTypeWire
  category_id: string | null
  default_merchant: string | null
  auto_confirm: boolean
}

export type LearnRequestWire = {
  sample: EmailSampleWire
  picks: FieldPicksWire
  options: LearnOptionsWire
  similar: EmailSampleWire[]
}

export type LearnResultWire = LearnedWire & {
  similar: ExtractionWire[]
  suggested_filter: RuleFilterWire
}

export type TestRequestWire = {
  rules?: EmailRuleDraftWire[]
  samples: EmailSampleWire[]
  focus_index?: number
}

export type SampleVerdictWire = {
  sample_id: string | null
  matched_index: number | null
  matched_rule_id: string | null
  extraction: ExtractionWire | null
  focus: { matched: boolean; extraction: ExtractionWire } | null
  would: WouldWire
}

export type TestResultWire = { results: SampleVerdictWire[] }

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
export type ConnectionSyncResultWire = {
  connection_id: string
  scanned_messages: number
  new_imports: number
  auto_confirmed: number
  ignored: number
  complete: boolean
}
export type SyncResultWire = {
  synced_connections: number
  scanned_messages: number
  new_imports: number
  auto_confirmed: number
  ignored?: number
  failures: SyncFailureWire[]
  connections?: ConnectionSyncResultWire[]
}

export type UpdateConnectionWire = {
  version: string
  auto_sync: boolean
  scan_frequency: ScanFrequencyWire
}

// --- Mappers -------------------------------------------------------------------------

export const toRuleSummary = (w: RuleSummaryWire): EmailRuleSummary => ({
  id: w.id,
  name: w.name,
  enabled: w.enabled,
  senders: w.senders,
  walletId: w.wallet_id,
  type: fromWireTxType(w.type),
  autoConfirm: w.auto_confirm,
})

export const toConnection = (w: ConnectionWire): EmailConnection => ({
  id: w.id,
  provider: fromWireProvider(w.provider),
  email: w.email_address,
  autoSync: w.auto_sync,
  scanFrequency: fromWireFrequency(w.scan_frequency),
  status: fromWireStatus(w.status),
  lastSyncedAt: w.last_synced_at,
  rules: w.rules.map(toRuleSummary),
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
  groupId: w.group_id,
})

export const toSampleWire = (s: EmailSample): EmailSampleWire => ({
  ...(s.id ? { id: s.id } : {}),
  sender_email: s.senderEmail,
  sender_name: s.senderName ?? null,
  subject: s.subject,
  body_lines: s.bodyLines,
})

export const toFilter = (w: RuleFilterWire): RuleFilter => ({
  senders: w.senders,
  subjectAny: w.subject_any,
  bodyAny: w.body_any,
  excludeAny: w.exclude_any,
})

export const toFilterWire = (f: RuleFilter): RuleFilterWire => ({
  senders: f.senders,
  subject_any: f.subjectAny,
  body_any: f.bodyAny,
  exclude_any: f.excludeAny,
})

export const toEmailRule = (w: EmailRuleWire): EmailRule => ({
  id: w.id,
  position: w.position,
  name: w.name,
  enabled: w.enabled,
  filter: toFilter(w.filter),
  template: toTemplate(w.template),
  walletId: w.wallet_id,
  type: fromWireTxType(w.type),
  categoryId: w.category_id,
  defaultMerchant: w.default_merchant ?? null,
  autoConfirm: w.auto_confirm,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toRuleSet = (w: EmailRuleSetWire): EmailRuleSet => ({
  version: w.version,
  rules: [...w.rules].sort((a, b) => a.position - b.position).map(toEmailRule),
})

export const toRuleDraftWire = (d: EmailRuleDraft): EmailRuleDraftWire => ({
  ...(d.id ? { id: d.id } : {}),
  name: d.name,
  enabled: d.enabled,
  filter: toFilterWire(d.filter),
  template: toTemplateWire(d.template),
  wallet_id: d.walletId,
  type: toWireTxType(d.type),
  category_id: d.categoryId,
  default_merchant: d.defaultMerchant,
  auto_confirm: d.autoConfirm,
})

/** A rule's summary as the connection list carries it, from the full rule. */
export const summaryOf = (r: EmailRule): EmailRuleSummary => ({
  id: r.id,
  name: r.name,
  enabled: r.enabled,
  senders: r.filter.senders,
  walletId: r.walletId,
  type: r.type,
  autoConfirm: r.autoConfirm,
})

export const toLearnRequestWire = (r: LearnRequest): LearnRequestWire => ({
  sample: toSampleWire(r.sample),
  picks: toPicksWire(r.picks),
  options: toLearnOptionsWire(r.options),
  similar: r.similar.map(toSampleWire),
})

export const toLearnResult = (w: LearnResultWire): LearnResult => ({
  ...toLearned(w),
  similar: w.similar.map(toExtraction),
  suggestedFilter: toFilter(w.suggested_filter),
})

export const toSampleVerdict = (w: SampleVerdictWire): SampleVerdict => ({
  sampleId: w.sample_id,
  matchedIndex: w.matched_index,
  matchedRuleId: w.matched_rule_id,
  extraction: w.extraction ? toExtraction(w.extraction) : null,
  focus: w.focus
    ? { matched: w.focus.matched, extraction: toExtraction(w.focus.extraction) }
    : null,
  would: lower<Would>(w.would),
})

export const toSyncResult = (w: SyncResultWire): SyncResult => ({
  syncedConnections: w.synced_connections,
  scannedMessages: w.scanned_messages,
  newImports: w.new_imports,
  autoConfirmed: w.auto_confirmed,
  ignored: w.ignored ?? 0,
  failures: w.failures.map((f) => ({
    connectionId: f.connection_id,
    code: f.code,
  })),
  connections: (w.connections ?? []).map((c) => ({
    connectionId: c.connection_id,
    scannedMessages: c.scanned_messages,
    newImports: c.new_imports,
    autoConfirmed: c.auto_confirmed,
    ignored: c.ignored,
    complete: c.complete,
  })),
})

/** Undefined fields are dropped by `JSON.stringify`, so `{}` stays an automatic scan. */
export const toSyncOptionsWire = (o: ScanOptions): SyncOptionsWire => ({
  connection_id: o.connectionId,
  lookback_days: o.lookbackDays,
  limit: o.limit,
})
