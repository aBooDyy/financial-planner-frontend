import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import type {
  AliasDraftWire,
  CreateMerchantWire,
  Merchant,
  MerchantAlias,
  UpdateMerchantWire,
} from '#/features/merchants/api/types'
import { toWireOrigin, toWireTxType } from '#/features/merchants/api/types'

export const serverMerchantToLocal = (m: Merchant): LocalMerchant => ({
  id: m.id,
  displayName: m.displayName,
  learnedCategory: m.learnedCategory,
  learnedSubcategory: m.learnedSubcategory,
  learnedType: m.learnedType,
  timesSeen: m.timesSeen,
  timesConfirmed: m.timesConfirmed,
  lastSeenAt: m.lastSeenAt,
  autoCategorize: m.autoCategorize,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
  version: m.version,
  dirty: 0,
  deleted: 0,
})

export const serverAliasToLocal = (a: MerchantAlias): LocalMerchantAlias => ({
  id: a.id,
  merchantId: a.merchantId,
  normalizedKey: a.normalizedKey,
  rawSample: a.rawSample,
  origin: a.origin,
  createdAt: a.createdAt,
  version: a.version,
  dirty: 0,
  deleted: 0,
})

export const localAliasToDraftWire = (
  a: LocalMerchantAlias,
): AliasDraftWire => ({
  normalized_key: a.normalizedKey,
  raw_sample: a.rawSample,
  origin: toWireOrigin(a.origin),
})

export const localMerchantToCreateWire = (
  m: LocalMerchant,
  aliases: LocalMerchantAlias[],
): CreateMerchantWire => ({
  id: m.id,
  display_name: m.displayName,
  aliases: aliases.map(localAliasToDraftWire),
  learned_category: m.learnedCategory,
  learned_subcategory: m.learnedSubcategory,
  learned_type: m.learnedType ? toWireTxType(m.learnedType) : null,
  auto_categorize: m.autoCategorize,
})

// The update is based on the last-synced `version` (optimistic locking base). Aliases are
// not edited here — they have their own endpoints.
export const localMerchantToUpdateWire = (
  m: LocalMerchant,
): UpdateMerchantWire => ({
  version: m.version,
  display_name: m.displayName,
  learned_category: m.learnedCategory,
  learned_subcategory: m.learnedSubcategory,
  learned_type: m.learnedType ? toWireTxType(m.learnedType) : null,
  auto_categorize: m.autoCategorize,
})
