import { useMemo } from 'react'
import type { LocalExchangeRate } from '#/db/types'
import { useAppConfigStore } from '#/lib/config/appConfig'
import { mergeRates } from '#/lib/config/rates'
import type { RatesMap } from '#/lib/config/rates'

const NO_OVERRIDES: LocalExchangeRate[] = []

/**
 * The merged rates map (config seed, custom currencies, the user's override rows), kept
 * referentially stable so memos and live-query deps keyed on it hold between renders.
 */
export function useStableRates(
  rows: LocalExchangeRate[] | undefined,
): RatesMap {
  // `mergeRates` reads these two from the store; as deps they re-derive the map on a refresh.
  const seeded = useAppConfigStore((s) => s.config.rates)
  const custom = useAppConfigStore((s) => s.custom)
  return useMemo(() => mergeRates(rows ?? NO_OVERRIDES), [seeded, custom, rows])
}
