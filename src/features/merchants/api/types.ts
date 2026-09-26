import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'

/**
 * Merchant contracts. Internal representation is lowercase like every other feature; the
 * wire is the backend's PersistedEnum UPPER_SNAKE name, translated only here.
 */
export type AliasOrigin = 'email' | 'import' | 'manual' | 'webhook'
export type AliasOriginWire = 'EMAIL' | 'IMPORT' | 'MANUAL' | 'WEBHOOK'

const ORIGIN_TO_WIRE: Record<AliasOrigin, AliasOriginWire> = {
  email: 'EMAIL',
  import: 'IMPORT',
  manual: 'MANUAL',
  webhook: 'WEBHOOK',
}
const ORIGIN_FROM_WIRE: Record<AliasOriginWire, AliasOrigin> = {
  EMAIL: 'email',
  IMPORT: 'import',
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
}

export const toWireOrigin = (o: AliasOrigin): AliasOriginWire =>
  ORIGIN_TO_WIRE[o]
export const fromWireOrigin = (w: AliasOriginWire): AliasOrigin =>
  ORIGIN_FROM_WIRE[w]

// --- Domain types (camelCase) --------------------------------------------------------

export type MerchantAlias = {
  id: string
  merchantId: string
  normalizedKey: string
  rawSample: string | null
  origin: AliasOrigin
  createdAt: string
  version: string
}

export type Merchant = {
  id: string
  displayName: string
  learnedCategoryId: string | null
  learnedType: TxType | null
  timesSeen: number
  timesConfirmed: number
  lastSeenAt: string | null
  autoCategorize: boolean
  aliases: MerchantAlias[]
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire types (snake_case) ---------------------------------------------------------

export type MerchantAliasWire = {
  id: string
  merchant_id: string
  normalized_key: string
  raw_sample: string | null
  origin: AliasOriginWire
  created_at: string
  version: string
}

export type MerchantWire = {
  id: string
  display_name: string
  learned_category_id: string | null
  learned_type: TxTypeWire | null
  times_seen: number
  times_confirmed: number
  last_seen_at: string | null
  auto_categorize: boolean
  aliases: MerchantAliasWire[]
  created_at: string
  updated_at: string
  version: string
}

/** One identifier proposed for a merchant. The server re-normalises whatever arrives. */
export type AliasDraftWire = {
  normalized_key: string
  raw_sample: string | null
  origin: AliasOriginWire
}

export type CreateMerchantWire = {
  id: string
  display_name: string
  aliases: AliasDraftWire[]
  learned_category_id: string | null
  learned_type: TxTypeWire | null
  auto_categorize: boolean
}

export type UpdateMerchantWire = {
  version: string
  display_name: string
  learned_category_id: string | null
  learned_type: TxTypeWire | null
  auto_categorize: boolean
}

export type AddAliasesWire = { aliases: AliasDraftWire[] }

export type MergeMerchantsWire = {
  source_id: string
  target_id: string
  /** The **source's** version — the row that disappears. */
  version: string
}

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toMerchantAlias = (w: MerchantAliasWire): MerchantAlias => ({
  id: w.id,
  merchantId: w.merchant_id,
  normalizedKey: w.normalized_key,
  rawSample: w.raw_sample,
  origin: fromWireOrigin(w.origin),
  createdAt: w.created_at,
  version: w.version,
})

export const toMerchant = (w: MerchantWire): Merchant => ({
  id: w.id,
  displayName: w.display_name,
  learnedCategoryId: w.learned_category_id,
  learnedType: w.learned_type ? fromWireTxType(w.learned_type) : null,
  timesSeen: w.times_seen,
  timesConfirmed: w.times_confirmed,
  lastSeenAt: w.last_seen_at,
  autoCategorize: w.auto_categorize,
  aliases: w.aliases.map(toMerchantAlias),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export { toWireTxType, fromWireTxType }
