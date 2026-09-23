import type { LocalCustomCurrency } from '#/db/types'
import type {
  CreateCustomCurrencyWire,
  CustomCurrency,
  UpdateCustomCurrencyWire,
} from '#/features/settings/api/types'

/** Server currency → local record (freshly synced: clean, not deleted). */
export const serverCustomCurrencyToLocal = (
  c: CustomCurrency,
): LocalCustomCurrency => ({
  id: c.id,
  code: c.code,
  name: c.name,
  symbol: c.symbol,
  minorUnit: c.minorUnit,
  rate: c.rate,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  version: c.version,
  dirty: 0,
  deleted: 0,
})

export const localCustomCurrencyToCreateWire = (
  l: LocalCustomCurrency,
): CreateCustomCurrencyWire => ({
  id: l.id,
  code: l.code,
  name: l.name,
  symbol: l.symbol,
  minor_unit: l.minorUnit,
  rate: String(l.rate),
})

export const localCustomCurrencyToUpdateWire = (
  l: LocalCustomCurrency,
): UpdateCustomCurrencyWire => ({
  version: l.version,
  name: l.name,
  symbol: l.symbol,
  rate: String(l.rate),
})
