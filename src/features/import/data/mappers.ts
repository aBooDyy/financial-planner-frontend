import { serializeTemplateConfig } from '#/features/import/api/types'
import type { LocalImportTemplate } from '#/db/types'
import type {
  CreateImportTemplateWire,
  ImportTemplate,
} from '#/features/import/api/types'

export const serverTemplateToLocal = (
  t: ImportTemplate,
): LocalImportTemplate => ({
  id: t.id,
  name: t.name,
  sourceKind: t.sourceKind,
  signature: t.signature,
  config: t.config,
  lastUsedAt: t.lastUsedAt,
  useCount: t.useCount,
  nameConflict: 0,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  version: t.version,
  dirty: 0,
  deleted: 0,
})

/**
 * A template whose config this client could not read still has a name, a signature and a
 * use count worth keeping — but its blob must never be written back from here, or a newer
 * client's mapping would be destroyed by an older one that merely failed to parse it.
 */
export const localTemplateToCreateWire = (
  t: LocalImportTemplate,
): CreateImportTemplateWire => {
  if (t.config === null) {
    throw new Error('An unreadable template config cannot be pushed.')
  }
  return {
    id: t.id,
    name: t.name,
    source_kind: 'CSV',
    signature: t.signature,
    config: serializeTemplateConfig(t.config),
    last_used_at: t.lastUsedAt,
    use_count: t.useCount,
  }
}
