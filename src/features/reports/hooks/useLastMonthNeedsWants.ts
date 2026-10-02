import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { needsWantsSummary } from '#/features/reports/data/needsWants'
import type { NeedsWantsSummary } from '#/features/reports/data/needsWants'
import type { RangePreset } from '#/features/reports/data/range'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { useStableRates } from '#/hooks/useStableRates'

export type NeedsWantsSummaryView = {
  loading: boolean
  /** Null while loading. */
  summary: NeedsWantsSummary | null
  /** The `/reports` search that shows the same month in full. */
  reportSearch: { range: RangePreset }
}

/**
 * Last calendar month's Needs / Wants / Savings split across every account — the one-line
 * summary ("Last month: Needs 48% · Wants 31% · Savings 21%") a page links to Reports with.
 */
export function useLastMonthNeedsWants(): NeedsWantsSummaryView {
  const today = startOfToday()
  const from = ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1))
  const to = ymd(new Date(today.getFullYear(), today.getMonth(), 0))

  const rows = useLiveQuery(
    () => db.transactions.where('date').between(from, to, true, true).toArray(),
    [from, to],
  )
  const settings = useLiveQuery(
    async () => (await db.balanceSettings.get(SETTINGS_KEY)) ?? null,
  )
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const rates = useStableRates(rateRows)
  const { catalog, loaded } = useCategoryCatalogState()

  const loading =
    rows === undefined ||
    settings === undefined ||
    rateRows === undefined ||
    !loaded
  const base = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  const summary = useMemo(
    () =>
      loading
        ? null
        : needsWantsSummary({ rows, from, to, catalog, base, rates }),
    [loading, rows, from, to, catalog, base, rates],
  )

  return { loading, summary, reportSearch: { range: 'last_month' } }
}
