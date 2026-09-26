import { TEMPLATE_CONFIG_VERSION } from '#/features/import/data/types'
import type { StoredTemplateConfig } from '#/features/import/data/types'

/**
 * Import-template contracts. The one unusual thing here is `config`: an opaque JSON
 * **string** on the wire, which the server stores and echoes back byte-for-byte without
 * ever parsing it. That is what lets the mapping's shape change without a backend deploy —
 * and what makes the parse on the way in this client's problem, not the server's.
 */

export type ImportSourceKindWire = 'CSV'

export type ImportTemplateWire = {
  id: string
  name: string
  source_kind: ImportSourceKindWire
  signature: string
  config: string
  last_used_at: string | null
  use_count: number
  created_at: string
  updated_at: string
  version: string
}

export type ImportTemplate = {
  id: string
  name: string
  sourceKind: 'csv'
  signature: string
  /** Null when the blob could not be read — see `parseTemplateConfig`. */
  config: StoredTemplateConfig | null
  lastUsedAt: string | null
  useCount: number
  createdAt: string
  updatedAt: string
  version: string
}

export type CreateImportTemplateWire = {
  id: string
  name: string
  source_kind: ImportSourceKindWire
  signature: string
  config: string
  last_used_at: string | null
  use_count: number
}

/**
 * A true partial: `version` plus only what changed. An omitted field is left alone, which
 * is what makes a row whose `config` this client cannot read still safely renamable.
 */
export type UpdateImportTemplateWire = {
  version: string
  name?: string
  signature?: string
  config?: string
  last_used_at?: string
  use_count?: number
}

/**
 * The server's cap on the blob, mirrored here so an oversized mapping fails at the click
 * instead of as a silent outbox drop. Measured exactly the way the server measures it:
 * UTF-8 bytes of the serialised JSON, refused when *greater than* the cap.
 *
 * Hard-coded because `GET /config`'s `limits` block does not publish it — there is no
 * `import_template_max_bytes`. So this number and
 * `app/services/import_template_services/import_template_rules.py` must move together; a
 * client that guesses low merely refuses early, and one that guesses high hands the user a
 * 422 from the wire. A mapping is orders of magnitude smaller than this either way.
 */
export const MAX_CONFIG_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The default category, as each version names it: version 2 by id per direction, version 1
 * by the slug `upgradeTemplateConfig` looks up.
 */
const hasDefaultCategory = (
  version: unknown,
  defaults: Record<string, unknown>,
): boolean => {
  if (typeof version === 'number' && version >= TEMPLATE_CONFIG_VERSION) {
    const ids = defaults.categoryIds
    return (
      isRecord(ids) &&
      typeof ids.spend === 'string' &&
      typeof ids.income === 'string'
    )
  }
  return typeof defaults.category === 'string'
}

/** The parts `applyTemplateConfig` reads unguarded, so their absence is a parse failure. */
const hasShape = (value: Record<string, unknown>): boolean => {
  const aliases = value.aliases
  return (
    isRecord(value.dialect) &&
    Array.isArray(value.roles) &&
    isRecord(value.defaults) &&
    hasDefaultCategory(value.version, value.defaults) &&
    isRecord(aliases) &&
    isRecord(aliases.wallets) &&
    isRecord(aliases.categories) &&
    isRecord(aliases.merchants)
  )
}

/**
 * Tolerant by contract. The server never parses this blob, so a corrupt one arrives here
 * looking like any other; a blob we cannot read is **not** an error, and the honest answer
 * is to keep the row, say it needs rebuilding, and leave its bytes on the server untouched.
 */
export const parseTemplateConfig = (
  raw: string,
): StoredTemplateConfig | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (!hasShape(parsed)) return null
  return parsed as unknown as StoredTemplateConfig
}

export const serializeTemplateConfig = (config: StoredTemplateConfig): string =>
  JSON.stringify(config)

export const configByteLength = (config: StoredTemplateConfig): number =>
  new TextEncoder().encode(serializeTemplateConfig(config)).length

export const toImportTemplate = (w: ImportTemplateWire): ImportTemplate => ({
  id: w.id,
  name: w.name,
  sourceKind: 'csv',
  signature: w.signature,
  config: parseTemplateConfig(w.config),
  lastUsedAt: w.last_used_at,
  useCount: w.use_count,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})
