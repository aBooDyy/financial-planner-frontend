import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'

/**
 * Where a spending category sits in the 50/30/20 split. Null on a subcategory inherits its
 * root's; null on a root means not sorted yet. Income categories never carry one.
 */
export type SpendClass = 'need' | 'want' | 'saving'
export type SpendClassWire = 'NEED' | 'WANT' | 'SAVING'

const SPEND_CLASS_TO_WIRE: Record<SpendClass, SpendClassWire> = {
  need: 'NEED',
  want: 'WANT',
  saving: 'SAVING',
}
const SPEND_CLASS_FROM_WIRE: Record<SpendClassWire, SpendClass> = {
  NEED: 'need',
  WANT: 'want',
  SAVING: 'saving',
}

export const toWireSpendClass = (
  c: SpendClass | null | undefined,
): SpendClassWire | null => (c ? SPEND_CLASS_TO_WIRE[c] : null)
export const fromWireSpendClass = (
  w: SpendClassWire | null | undefined,
): SpendClass | null => (w ? SPEND_CLASS_FROM_WIRE[w] : null)

/**
 * Wire/domain types for the user-editable category tree. A row with `parentId === null` is
 * a category; one with a parent is a subcategory. Two levels, no deeper.
 */

export type Category = {
  id: string
  parentId: string | null
  slug: string
  name: string
  type: TxType
  color: string
  icon: string | null
  spendClass: SpendClass | null
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
  spend_class?: SpendClassWire | null
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
  spend_class: SpendClassWire | null
  position: number
}

/** `parent.id` is null for the top level; a different one moves it. */
export type UpdateCategoryWire = {
  version: string
  name: string
  color: string
  icon: string | null
  spend_class: SpendClassWire | null
  position: number
  parent: { id: string | null }
}

/** Present when the deleted category's rows (and budgets, merchants, rules) move to another one. */
export type DeleteCategoryWire = { move_to: string }

export const toCategory = (w: CategoryWire): Category => ({
  id: w.id,
  parentId: w.parent_id,
  slug: w.slug,
  name: w.name,
  type: fromWireTxType(w.type),
  color: w.color,
  icon: w.icon,
  spendClass: fromWireSpendClass(w.spend_class),
  position: w.position,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export { toWireTxType }
