import type { LocalCategory } from '#/db/types'
import type {
  Category,
  CreateCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'
import { toWireSpendClass, toWireTxType } from '#/features/categories/api/types'

/** Server category → local record (freshly synced: clean, not deleted). */
export const serverCategoryToLocal = (c: Category): LocalCategory => ({
  id: c.id,
  parentId: c.parentId,
  slug: c.slug,
  name: c.name,
  type: c.type,
  color: c.color,
  icon: c.icon,
  spendClass: c.spendClass,
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
  spend_class: toWireSpendClass(l.spendClass),
  position: l.position,
})

/**
 * A queued category update. `spend_class` is absent when this device has never been told the
 * row's class (a row stored before it existed, not pulled since): the push fills in the server's.
 */
export type QueuedCategoryUpdate = Omit<UpdateCategoryWire, 'spend_class'> &
  Partial<Pick<UpdateCategoryWire, 'spend_class'>>

// The update is based on the last-synced `version` (optimistic locking base). `icon` and
// `spend_class` are replace-on-PATCH: omitting one clears it, so a known value always goes.
export const localCategoryToUpdateWire = (
  l: LocalCategory,
): QueuedCategoryUpdate => ({
  version: l.version,
  name: l.name,
  color: l.color,
  icon: l.icon,
  ...(l.spendClass === undefined
    ? {}
    : { spend_class: toWireSpendClass(l.spendClass) }),
  position: l.position,
  parent: { id: l.parentId },
})
