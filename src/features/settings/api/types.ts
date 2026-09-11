import type { TxType, TxTypeWire } from '#/features/transactions/api/types'
import { fromWireTxType, toWireTxType } from '#/features/transactions/api/types'

/**
 * Wire/domain types for the Settings entities: user-editable categories, plus the small
 * payloads for editing an exchange rate and the user profile. Categories follow the same
 * lowercase-domain / UPPER_SNAKE-wire convention as the rest of the app.
 */

// --- Categories ----------------------------------------------------------------------

export type Category = {
  id: string
  slug: string
  name: string
  type: TxType
  color: string
  position: number
  createdAt: string
  updatedAt: string
  version: string
}

export type CategoryWire = {
  id: string
  slug: string
  name: string
  type: TxTypeWire
  color: string
  position: number
  created_at: string
  updated_at: string
  version: string
}

export type CreateCategoryWire = {
  id: string
  slug: string
  name: string
  type: TxTypeWire
  color: string
  position: number
}

export type UpdateCategoryWire = {
  version: string
  name: string
  color: string
  position: number
}

export const toCategory = (w: CategoryWire): Category => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  type: fromWireTxType(w.type),
  color: w.color,
  position: w.position,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

export { toWireTxType }

// --- Exchange-rate edit + profile edit payloads --------------------------------------

export type UpdateRateWire = { version: string; rate: string }

export type UpdateProfileWire = {
  version: string
  name: string
  email: string
}
