import type {
  ConnectionStatus,
  EmailProvider,
  EmailRuleSummary,
  ScanFrequency,
} from '#/db/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'
import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireCurrencyOrNull } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

// Re-export the domain enums so the rest of the feature imports them from one place.
export type {
  ConnectionStatus,
  EmailProvider,
  EmailRuleSummary,
  ScanFrequency,
} from '#/db/types'

/**
 * Internal representation stays lowercase; the wire is the backend's UPPER_SNAKE name.
 * Translate only at this boundary. Email-sync entities are server-owned (online feature), so
 * there are no local drafts pushed via the outbox — just request payloads sent directly.
 */
export type EmailProviderWire = 'GOOGLE' | 'OUTLOOK'
export type ScanFrequencyWire = 'FIFTEEN_MIN' | 'HOURLY' | 'DAILY'
export type ConnectionStatusWire = 'PENDING_SETUP' | 'CONNECTED'
export type DecimalStyleWire = 'AUTO' | 'DOT' | 'COMMA'
export type CurrencyModeWire = 'FROM_EMAIL' | 'FIXED'
export type ReadingStatusWire =
  | 'OK'
  | 'ANCHOR_NOT_FOUND'
  | 'NO_NUMBER'
  | 'OUT_OF_RANGE'
  | 'NO_CURRENCY'
  | 'HEURISTIC'
  | 'NOT_SET'
export type WouldWire = 'STAGE' | 'POST' | 'IGNORE'
export type LabelSourceWire = 'PICKED' | 'SAME_LINE' | 'NEARBY' | 'KEYWORDS'

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

const lower = <T extends string>(w: string): T => w.toLowerCase() as T
const upper = <T extends string>(v: string): T => v.toUpperCase() as T

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

export type DecimalStyle = 'auto' | 'dot' | 'comma'
export type CurrencyMode = 'from_email' | 'fixed'

/**
 * The words a value is found by, and where it sits from them: `offset` lines after the label's
 * line (0 = on the same line, after the label).
 */
export type TemplateLabel = { text: string; offset: number }

export type AmountSpec = {
  /** Null reads the amount by keywords alone. */
  label: TemplateLabel | null
  /** Which number on the value line; null reads the one next to the currency. */
  numberIndex: number | null
  decimal: DecimalStyle
}

export type CurrencySpec =
  | {
      mode: 'from_email'
      label: TemplateLabel | null
      code: CurrencyCode | null
    }
  | { mode: 'fixed'; code: CurrencyCode }

/** How a rule reads an email — learned from the user's picks on a sample. */
export type ExtractionTemplate = {
  kind: string
  amount: AmountSpec
  currency: CurrencySpec
  merchant: { label: TemplateLabel } | null
}

export type ReadingStatus = Lowercase<ReadingStatusWire>

export type FieldReading = {
  status: ReadingStatus
  raw: string | null
  /** Index into the sample's body lines. */
  line: number | null
}

export type ExtractField = 'amount' | 'currency' | 'merchant'

export type Extraction = {
  /** Minor units of `currency`; null unless both were read. */
  amount: number | null
  currency: CurrencyCode | null
  merchant: string | null
  complete: boolean
  fields: Record<ExtractField, FieldReading>
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

/**
 * The value the user tapped: a whole line, or a span inside it. `labelLine` is the line the
 * user says labels it; left out, the server finds the label itself.
 */
export type FieldPick = {
  line: number
  start?: number
  end?: number
  labelLine?: number
}

export type FieldPicks = {
  amount: FieldPick | null
  currency: FieldPick | null
  merchant: FieldPick | null
}

export type LearnOptions = {
  decimal: DecimalStyle
  currency: { mode: CurrencyMode; code: CurrencyCode | null }
}

export type LearnRequest = {
  sample: EmailSample
  picks: FieldPicks & { amount: FieldPick }
  options: LearnOptions
  similar: EmailSample[]
}

export type LabelSource = Lowercase<LabelSourceWire>

/** How the learned rule finds one field on the sample. */
export type LearnedLabel = {
  /** The label's line in the sample; null (with `text` and `offset`) when read by keywords. */
  line: number | null
  /** The label as the email writes it. */
  text: string | null
  offset: number | null
  source: LabelSource
  /** Reading the sample again with the rule gives back what was tapped. */
  verified: boolean
}

/** Null for a field that was not tapped, or a fixed currency. */
export type LearnedLabels = Record<ExtractField, LearnedLabel | null>

export type LearnResult = {
  template: ExtractionTemplate
  reading: Extraction
  similar: Extraction[]
  suggestedFilter: RuleFilter
  labels: LearnedLabels
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

export type TemplateLabelWire = { text: string; offset: number }

export type TemplateWire = {
  kind: string
  amount: {
    label: TemplateLabelWire | null
    number_index: number | null
    decimal: DecimalStyleWire
  }
  currency:
    | {
        mode: 'FROM_EMAIL'
        label: TemplateLabelWire | null
        code: string | null
      }
    | { mode: 'FIXED'; code: string }
  merchant: { label: TemplateLabelWire } | null
}

export type FieldReadingWire = {
  status: ReadingStatusWire
  raw: string | null
  line: number | null
}

export type ExtractionWire = {
  amount: number | null
  currency: string | null
  merchant: string | null
  complete: boolean
  fields: Record<ExtractField, FieldReadingWire>
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

export type FieldPickWire = {
  line: number
  start?: number
  end?: number
  label_line: number | null
}

export type LearnRequestWire = {
  sample: EmailSampleWire
  picks: {
    amount: FieldPickWire
    currency: FieldPickWire | null
    merchant: FieldPickWire | null
  }
  options: {
    decimal: DecimalStyleWire
    currency: { mode: CurrencyModeWire; code: string | null }
  }
  similar: EmailSampleWire[]
}

export type LearnedLabelWire = {
  line: number | null
  text: string | null
  offset: number | null
  source: LabelSourceWire
  verified: boolean
}

export type LearnResultWire = {
  template: TemplateWire
  reading: ExtractionWire
  similar: ExtractionWire[]
  suggested_filter: RuleFilterWire
  labels: Record<ExtractField, LearnedLabelWire | null>
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

const toLabel = (w: TemplateLabelWire): TemplateLabel => ({
  text: w.text,
  offset: w.offset,
})

const toLabelOrNull = (w: TemplateLabelWire | null): TemplateLabel | null =>
  w ? toLabel(w) : null

const toLabelWire = (l: TemplateLabel): TemplateLabelWire => ({
  text: l.text,
  offset: l.offset,
})

const toLabelWireOrNull = (
  l: TemplateLabel | null,
): TemplateLabelWire | null => (l ? toLabelWire(l) : null)

export const toTemplate = (w: TemplateWire): ExtractionTemplate => ({
  kind: w.kind,
  amount: {
    label: toLabelOrNull(w.amount.label),
    numberIndex: w.amount.number_index,
    decimal: lower<DecimalStyle>(w.amount.decimal),
  },
  currency:
    w.currency.mode === 'FIXED'
      ? { mode: 'fixed', code: w.currency.code }
      : {
          mode: 'from_email',
          label: toLabelOrNull(w.currency.label),
          code: fromWireCurrencyOrNull(w.currency.code),
        },
  merchant: w.merchant ? { label: toLabel(w.merchant.label) } : null,
})

export const toTemplateWire = (t: ExtractionTemplate): TemplateWire => ({
  kind: t.kind,
  amount: {
    label: toLabelWireOrNull(t.amount.label),
    number_index: t.amount.numberIndex,
    decimal: upper<DecimalStyleWire>(t.amount.decimal),
  },
  currency:
    t.currency.mode === 'fixed'
      ? { mode: 'FIXED', code: t.currency.code }
      : {
          mode: 'FROM_EMAIL',
          label: toLabelWireOrNull(t.currency.label),
          code: t.currency.code,
        },
  merchant: t.merchant ? { label: toLabelWire(t.merchant.label) } : null,
})

const toReading = (w: FieldReadingWire): FieldReading => ({
  status: lower<ReadingStatus>(w.status),
  raw: w.raw,
  line: w.line,
})

export const toExtraction = (w: ExtractionWire): Extraction => ({
  amount: w.amount,
  currency: fromWireCurrencyOrNull(w.currency),
  merchant: w.merchant,
  complete: w.complete,
  fields: {
    amount: toReading(w.fields.amount),
    currency: toReading(w.fields.currency),
    merchant: toReading(w.fields.merchant),
  },
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

export const toPickWire = (p: FieldPick): FieldPickWire => ({
  line: p.line,
  ...(p.start !== undefined && p.end !== undefined
    ? { start: p.start, end: p.end }
    : {}),
  label_line: p.labelLine ?? null,
})

const toPickWireOrNull = (p: FieldPick | null): FieldPickWire | null =>
  p ? toPickWire(p) : null

export const toLearnRequestWire = (r: LearnRequest): LearnRequestWire => ({
  sample: toSampleWire(r.sample),
  picks: {
    amount: toPickWire(r.picks.amount),
    currency: toPickWireOrNull(r.picks.currency),
    merchant: toPickWireOrNull(r.picks.merchant),
  },
  options: {
    decimal: upper<DecimalStyleWire>(r.options.decimal),
    currency: {
      mode: upper<CurrencyModeWire>(r.options.currency.mode),
      code: r.options.currency.code,
    },
  },
  similar: r.similar.map(toSampleWire),
})

const toLearnedLabel = (w: LearnedLabelWire | null): LearnedLabel | null =>
  w
    ? {
        line: w.line,
        text: w.text,
        offset: w.offset,
        source: lower<LabelSource>(w.source),
        verified: w.verified,
      }
    : null

export const toLearnResult = (w: LearnResultWire): LearnResult => ({
  template: toTemplate(w.template),
  reading: toExtraction(w.reading),
  similar: w.similar.map(toExtraction),
  suggestedFilter: toFilter(w.suggested_filter),
  labels: {
    amount: toLearnedLabel(w.labels.amount),
    currency: toLearnedLabel(w.labels.currency),
    merchant: toLearnedLabel(w.labels.merchant),
  },
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
