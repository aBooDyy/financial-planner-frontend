import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'

/**
 * Wire/domain types for the user-editable category tree. A row with `parentId === null` is
 * a category; one with a parent is a subcategory. Two levels, no deeper — the ledger stores
 * exactly one `(category, subcategory)` slug pair.
 */

export type Category = {
  id: string
  parentId: string | null
  slug: string
  name: string
  type: TxType
  color: string
  icon: string | null
  position: number
  createdAt: string
  updatedAt: string
  version: string
}

export type CategoryWire = {
  id: string
  parent_id: string | null
  slug: string
  name: string
  type: TxTypeWire
  color: string
  icon: string | null
  position: number
  created_at: string
  updated_at: string
  version: string
}

export type CreateCategoryWire = {
  id: string
  parent_id: string | null
  slug: string
  name: string
  type: TxTypeWire
  color: string
  icon: string | null
  position: number
}

/** No `parent_id`: a category never moves between parents. */
export type UpdateCategoryWire = {
  version: string
  name: string
  color: string
  icon: string | null
  position: number
}

export const toCategory = (w: CategoryWire): Category => ({
  id: w.id,
  parentId: w.parent_id,
  slug: w.slug,
  name: w.name,
  type: fromWireTxType(w.type),
  color: w.color,
  icon: w.icon,
  position: w.position,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export { toWireTxType }
