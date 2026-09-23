import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalCustomCurrency } from '#/db/types'
import { useAppConfigStore } from './appConfig'
import type { CustomCurrencyMeta } from './appConfig'

const toMeta = (c: LocalCustomCurrency): CustomCurrencyMeta => ({
  id: c.id,
  code: c.code,
  name: c.name,
  symbol: c.symbol,
  minorUnit: c.minorUnit,
  rate: c.rate,
  custom: true,
})

/**
 * Mirrors the user's own currencies from the local DB into the config store, once, from the
 * root layout. They live in Dexie because they are user data that syncs, but every currency
 * helper (`decimalsFor`, `currencySymbol`, `fromWireCurrency`) is synchronous and reads the
 * store — so the store is where a currency has to be for the rest of the app to see it.
 */
export function useCustomCurrencies(): void {
  const rows = useLiveQuery(() => db.customCurrencies.toArray())
  const apply = useAppConfigStore((s) => s.applyCustomCurrencies)

  useEffect(() => {
    if (rows === undefined) return
    apply(rows.filter((c) => c.deleted === 0).map(toMeta))
  }, [rows, apply])
}
