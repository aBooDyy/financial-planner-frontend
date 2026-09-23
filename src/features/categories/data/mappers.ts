import type { LocalCategory } from '#/db/types'
import type {
  Category,
  CreateCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'
import { toWireTxType } from '#/features/categories/api/types'

/** Server category → local record (freshly synced: clean, not deleted). */
export const serverCategoryToLocal = (c: Category): LocalCategory => ({
  id: c.id,
  parentId: c.parentId,
  slug: c.slug,
  name: c.name,
  type: c.type,
  color: c.color,
  icon: c.icon,
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
  parent_id: l.parentId,
  slug: l.slug,
  name: l.name,
  type: toWireTxType(l.type),
  color: l.color,
  icon: l.icon,
  position: l.position,
})

// The update is based on the last-synced `version` (optimistic locking base). `icon` is
// replace-on-PATCH: omitting it clears it, so the current value always goes along.
export const localCategoryToUpdateWire = (
  l: LocalCategory,
): UpdateCategoryWire => ({
  version: l.version,
  name: l.name,
  color: l.color,
  icon: l.icon,
  position: l.position,
})
