import type { BodyFormat, ImportStatus, InboundSource } from '#/db/types'
import type {
  Transaction,
  TransactionWire,
  TxType,
  TxTypeWire,
} from '#/features/transactions/api/types'
import {
  fromWireTxType,
  toTransaction,
} from '#/features/transactions/api/types'
import { fromWireCurrencyOrNull } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export type { BodyFormat, ImportStatus, InboundSource } from '#/db/types'

/**
 * Internal representation stays lowercase; the wire is the backend's PersistedEnum
 * UPPER_SNAKE name. Translate only at this boundary. Inbound imports are server-owned, so
 * there are no local drafts pushed via the outbox — just the payloads the API layer sends.
 */
type ImportStatusWire = 'PENDING' | 'CONFIRMED' | 'DISMISSED'
type InboundSourceWire = 'INBOX' | 'WEBHOOK'
type BodyFormatWire = 'TEXT' | 'JSON'

const IMPORT_STATUS_FROM_WIRE: Record<ImportStatusWire, ImportStatus> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DISMISSED: 'dismissed',
}
const SOURCE_FROM_WIRE: Record<InboundSourceWire, InboundSource> = {
  INBOX: 'inbox',
  WEBHOOK: 'webhook',
}
const BODY_FORMAT_FROM_WIRE: Record<BodyFormatWire, BodyFormat> = {
  TEXT: 'text',
  JSON: 'json',
}

const fromWireImportStatus = (w: ImportStatusWire): ImportStatus =>
  IMPORT_STATUS_FROM_WIRE[w]
export const fromWireSource = (w: InboundSourceWire): InboundSource =>
  SOURCE_FROM_WIRE[w]
const fromWireBodyFormat = (w: BodyFormatWire): BodyFormat =>
  BODY_FORMAT_FROM_WIRE[w]

// --- Domain types --------------------------------------------------------------------

export type InboundImport = {
  id: string
  source: InboundSource
  connectionId: string | null
  keyId: string | null
  merchantId: string | null
  sourceRef: string | null
  sourceLabel: string | null
  subject: string | null
  occurredOn: string | null
  amount: number | null
  currency: CurrencyCode | null
  suggestedMerchant: string | null
  suggestedCategory: string | null
  suggestedSubcategory: string | null
  suggestedType: TxType | null
  suggestedWalletId: string | null
  rawPreview: string | null
  /** Whether the stored body can be fetched (false for rows staged before bodies were kept). */
  hasBody: boolean
  bodyFormat: BodyFormat
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

/** One import plus the body it came from — the review screen reads its values off this. */
export type ImportDetail = {
  import: InboundImport
  bodyLines: string[]
  bodyTruncated: boolean
  merchant: ImportMerchant | null
}

export type ConfirmResult = { transaction: Transaction; import: InboundImport }

// --- Wire types ----------------------------------------------------------------------

export type InboundImportWire = {
  id: string
  source: InboundSourceWire
  connection_id: string | null
  integration_key_id: string | null
  rule_id: string | null
  transaction_id: string | null
  merchant_id: string | null
  source_ref: string | null
  source_label: string | null
  subject: string | null
  occurred_on: string | null
  amount: number | null
  currency: string | null
  suggested_merchant: string | null
  suggested_category: string | null
  suggested_subcategory: string | null
  suggested_type: TxTypeWire | null
  suggested_wallet_id: string | null
  raw_preview: string | null
  has_body: boolean
  body_format: BodyFormatWire
  status: ImportStatusWire
  created_at: string
  version: string
}

type ImportMerchantWire = {
  id: string
  display_name: string
  learned_category: string | null
  learned_subcategory: string | null
  times_seen: number
  times_confirmed: number
}

export type ImportDetailWire = {
  inbound_import: InboundImportWire
  body_lines: string[]
  body_truncated: boolean
  merchant: ImportMerchantWire | null
}

/**
 * Confirm payload. The value fields are optional overrides — the only way to promote an
 * import whose parse came back empty, typed by the user off the stored body.
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

export type ConfirmResultWire = {
  transaction: TransactionWire
  inbound_import: InboundImportWire
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toInboundImport = (w: InboundImportWire): InboundImport => ({
  id: w.id,
  source: fromWireSource(w.source),
  connectionId: w.connection_id,
  keyId: w.integration_key_id,
  merchantId: w.merchant_id,
  sourceRef: w.source_ref,
  sourceLabel: w.source_label,
  subject: w.subject,
  occurredOn: w.occurred_on,
  amount: w.amount,
  currency: fromWireCurrencyOrNull(w.currency),
  suggestedMerchant: w.suggested_merchant,
  suggestedCategory: w.suggested_category,
  suggestedSubcategory: w.suggested_subcategory,
  suggestedType: w.suggested_type ? fromWireTxType(w.suggested_type) : null,
  suggestedWalletId: w.suggested_wallet_id,
  rawPreview: w.raw_preview,
  hasBody: w.has_body,
  bodyFormat: fromWireBodyFormat(w.body_format),
  status: fromWireImportStatus(w.status),
  transactionId: w.transaction_id,
  createdAt: w.created_at,
  version: w.version,
})

const toImportMerchant = (w: ImportMerchantWire): ImportMerchant => ({
  id: w.id,
  displayName: w.display_name,
  learnedCategory: w.learned_category,
  learnedSubcategory: w.learned_subcategory,
  timesSeen: w.times_seen,
  timesConfirmed: w.times_confirmed,
})

export const toImportDetail = (w: ImportDetailWire): ImportDetail => ({
  import: toInboundImport(w.inbound_import),
  bodyLines: w.body_lines,
  bodyTruncated: w.body_truncated,
  merchant: w.merchant ? toImportMerchant(w.merchant) : null,
})

export const toConfirmResult = (w: ConfirmResultWire): ConfirmResult => ({
  transaction: toTransaction(w.transaction),
  import: toInboundImport(w.inbound_import),
})
