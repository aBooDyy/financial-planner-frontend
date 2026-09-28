import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'

/** What both the results and the filter panel read: the account tree, base currency, catalog. */
export function useSearchBasics(enabled: boolean) {
  const nodeRows = useLiveQuery(
    async () => (enabled ? db.balanceNodes.toArray() : undefined),
    [enabled],
  )
  // `null`, not `undefined`, when there is no row — so "no settings" is not "still loading".
  const settings = useLiveQuery(
    async () =>
      enabled
        ? ((await db.balanceSettings.get(SETTINGS_KEY)) ?? null)
        : undefined,
    [enabled],
  )
  const { catalog, loaded: catalogLoaded } = useCategoryCatalogState()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  return {
    nodeRows,
    base,
    catalog,
    dateFormat,
    loading: nodeRows === undefined || settings === undefined || !catalogLoaded,
  }
}
