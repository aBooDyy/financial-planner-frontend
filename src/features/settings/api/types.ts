/**
 * Wire/domain types for the Settings entities: the user's own currencies, plus the small
 * payloads for editing an exchange rate and the user profile. Categories live in
 * `features/categories/api/types.ts`.
 */

// --- Custom currencies ---------------------------------------------------------------

export type CustomCurrency = {
  id: string
  code: string
  name: string
  symbol: string
  minorUnit: number
  /** Units of the reference currency per 1 unit — the same direction as a seed rate. */
  rate: number
  createdAt: string
  updatedAt: string
  version: string
}

export type CustomCurrencyWire = {
  id: string
  code: string
  name: string
  symbol: string
  minor_unit: number
  rate: string
  created_at: string
  updated_at: string
  version: string
}

export type CreateCustomCurrencyWire = {
  id: string
  code: string
  name: string
  symbol: string
  minor_unit: number
  rate: string
}

/** Code and minor unit are fixed at creation: stored amounts are already scaled by one and
 *  found by the other. */
export type UpdateCustomCurrencyWire = {
  version: string
  name: string
  symbol: string
  rate: string
}

export const toCustomCurrency = (w: CustomCurrencyWire): CustomCurrency => ({
  id: w.id,
  code: w.code,
  name: w.name,
  symbol: w.symbol,
  minorUnit: w.minor_unit,
  rate: Number(w.rate),
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

// --- Exchange-rate edit + profile edit payloads --------------------------------------

/** `version` is omitted on the first edit of a currency: there is no row to collide with
 *  yet, and the server creates one (copy-on-write). */
export type UpdateRateWire = { version?: string; rate: string }

export type UpdateProfileWire = {
  version: string
  name: string
  email: string
}
