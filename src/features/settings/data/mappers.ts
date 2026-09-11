import type { LocalCategory } from '#/db/types'
import type {
  Category,
  CreateCategoryWire,
  UpdateCategoryWire,
} from '#/features/settings/api/types'
import { toWireTxType } from '#/features/settings/api/types'

/** Server category → local record (freshly synced: clean, not deleted). */
export const serverCategoryToLocal = (c: Category): LocalCategory => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  type: c.type,
  color: c.color,
  position: c.position,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  version: c.version,
  dirty: 0,
  deleted: 0,
})

export const localCategoryToCreateWire = (
  l: LocalCategory,
): CreateCategoryWire => ({
  id: l.id,
  slug: l.slug,
  name: l.name,
  type: toWireTxType(l.type),
  color: l.color,
  position: l.position,
})

// The update is based on the last-synced `version` (optimistic locking base).
export const localCategoryToUpdateWire = (
  l: LocalCategory,
): UpdateCategoryWire => ({
  version: l.version,
  name: l.name,
  color: l.color,
  position: l.position,
})
