import type { IntegrationKeyStatus } from '#/db/types'
import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'
import { fromWireCurrencyOrNull } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

export type { IntegrationKeyStatus } from '#/db/types'

/**
 * Internal enums stay lowercase; the wire is the backend's PersistedEnum UPPER_SNAKE name.
 * Keys are server-minted and online-only, so these shapes only ever cross this boundary via
 * direct API calls — never through the outbox.
 */
type IntegrationKeyStatusWire = 'ACTIVE' | 'REVOKED'
/** What a read may say. `EXPIRED` is derived from `expires_at` and is never sent back. */
type IntegrationKeyStatusReadWire = IntegrationKeyStatusWire | 'EXPIRED'

// An expired key's stored status is still ACTIVE, and expiry is re-derived locally from
// `expiresAt` — a cached row would otherwise stay "active" long after it lapsed.
const STATUS_FROM_WIRE: Record<
  IntegrationKeyStatusReadWire,
  IntegrationKeyStatus
> = {
  ACTIVE: 'active',
  EXPIRED: 'active',
  REVOKED: 'revoked',
}
const STATUS_TO_WIRE: Record<IntegrationKeyStatus, IntegrationKeyStatusWire> = {
  active: 'ACTIVE',
  revoked: 'REVOKED',
}

const fromWireKeyStatus = (
  w: IntegrationKeyStatusReadWire,
): IntegrationKeyStatus => STATUS_FROM_WIRE[w]
const toWireKeyStatus = (s: IntegrationKeyStatus): IntegrationKeyStatusWire =>
  STATUS_TO_WIRE[s]

// --- Domain types --------------------------------------------------------------------

export type IntegrationKey = {
  id: string
  name: string
  /** `fpk_` plus the 8-hex lookup prefix — safe to show, never the secret. */
  tokenPrefix: string
  status: IntegrationKeyStatus
  expiresAt: string | null
  rotatedAt: string | null
  lastUsedAt: string | null
  requestsCount: number
  rateLimitPerMinute: number
  throttledUntil: string | null
  defaultWalletId: string | null
  defaultCategory: string | null
  defaultSubcategory: string | null
  defaultType: TxType
  defaultCurrency: CurrencyCode | null
  autoConfirm: boolean
  stageUnmatched: boolean
  ruleCount: number
  createdAt: string
  updatedAt: string
  version: string
}

/** The only shape that ever carries the secret: a create or a rotate. */
export type CreatedKey = { key: IntegrationKey; token: string }

/** Everything the user can change on a key — the PATCH body, minus the lock. */
export type KeySettings = {
  name: string
  status: IntegrationKeyStatus
  expiresAt: string | null
  defaultWalletId: string | null
  defaultCategory: string | null
  defaultSubcategory: string | null
  defaultType: TxType
  defaultCurrency: CurrencyCode | null
  autoConfirm: boolean
  stageUnmatched: boolean
  rateLimitPerMinute: number
}

export type NewKey = {
  name: string
  expiresAt: string | null
  defaultWalletId: string | null
}

// --- Wire types ----------------------------------------------------------------------

export type IntegrationKeyWire = {
  id: string
  name: string
  token_prefix: string
  status: IntegrationKeyStatusReadWire
  expires_at: string | null
  rotated_at: string | null
  last_used_at: string | null
  requests_count: number
  rate_limit_per_minute: number
  throttled_until: string | null
  default_wallet_id: string | null
  default_category: string | null
  default_subcategory: string | null
  default_type: TxTypeWire
  default_currency: string | null
  auto_confirm: boolean
  stage_unmatched: boolean
  rule_count: number
  created_at: string
  updated_at: string
  version: string
}

export type CreatedKeyWire = { key: IntegrationKeyWire; token: string }

type CreateKeyWire = {
  name: string
  expires_at: string | null
  default_wallet_id: string | null
}

type UpdateKeyWire = {
  version: string
  name: string
  status: IntegrationKeyStatusWire
  expires_at: string | null
  default_wallet_id: string | null
  default_category: string | null
  default_subcategory: string | null
  default_type: TxTypeWire
  default_currency: string | null
  auto_confirm: boolean
  stage_unmatched: boolean
  rate_limit_per_minute: number
}

// --- Mappers -------------------------------------------------------------------------

export const toIntegrationKey = (w: IntegrationKeyWire): IntegrationKey => ({
  id: w.id,
  name: w.name,
  tokenPrefix: w.token_prefix,
  status: fromWireKeyStatus(w.status),
  expiresAt: w.expires_at,
  rotatedAt: w.rotated_at,
  lastUsedAt: w.last_used_at,
  requestsCount: w.requests_count,
  rateLimitPerMinute: w.rate_limit_per_minute,
  throttledUntil: w.throttled_until,
  defaultWalletId: w.default_wallet_id,
  defaultCategory: w.default_category,
  defaultSubcategory: w.default_subcategory,
  defaultType: fromWireTxType(w.default_type),
  defaultCurrency: fromWireCurrencyOrNull(w.default_currency),
  autoConfirm: w.auto_confirm,
  stageUnmatched: w.stage_unmatched,
  ruleCount: w.rule_count,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export const toCreatedKey = (w: CreatedKeyWire): CreatedKey => ({
  key: toIntegrationKey(w.key),
  token: w.token,
})

export const toCreateKeyWire = (k: NewKey): CreateKeyWire => ({
  name: k.name,
  expires_at: k.expiresAt,
  default_wallet_id: k.defaultWalletId,
})

export const toUpdateKeyWire = (
  version: string,
  s: KeySettings,
): UpdateKeyWire => ({
  version,
  name: s.name,
  status: toWireKeyStatus(s.status),
  expires_at: s.expiresAt,
  default_wallet_id: s.defaultWalletId,
  default_category: s.defaultCategory,
  default_subcategory: s.defaultSubcategory,
  default_type: toWireTxType(s.defaultType),
  default_currency: s.defaultCurrency,
  auto_confirm: s.autoConfirm,
  stage_unmatched: s.stageUnmatched,
  rate_limit_per_minute: s.rateLimitPerMinute,
})

/** A key's current settings, as the editor starts from them. */
export const settingsOf = (k: IntegrationKey): KeySettings => ({
  name: k.name,
  status: k.status,
  expiresAt: k.expiresAt,
  defaultWalletId: k.defaultWalletId,
  defaultCategory: k.defaultCategory,
  defaultSubcategory: k.defaultSubcategory,
  defaultType: k.defaultType,
  defaultCurrency: k.defaultCurrency,
  autoConfirm: k.autoConfirm,
  stageUnmatched: k.stageUnmatched,
  rateLimitPerMinute: k.rateLimitPerMinute,
})
