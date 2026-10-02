import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { readPayCalendar } from '#/features/transactions/data/payCalendar'
import { mergeRanges } from '#/features/transactions/data/ledgerRange'
import {
  budgetWindow,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import { budgetsLeft } from '#/features/transactions/data/selectors'
import type { BudgetLeft } from '#/features/transactions/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

const NONE: BudgetLeft[] = []

/**
 * What each budget still allows right now, for the caption under Safe to spend. Reads only
 * the rows inside the budgets' current windows.
 */
export function useBudgetsLeft(
  base: CurrencyCode,
  rates: RatesMap,
): BudgetLeft[] {
  const todayIso = ymd(startOfToday())
  const read = useLiveQuery(async () => {
    const budgets = (await db.budgets.toArray()).filter((b) => b.deleted === 0)
    if (budgets.length === 0) return null
    const today = startOfToday()
    const payCalendar = await readPayCalendar(todayIso)
    const windows = mergeRanges(
      budgets.map((b) => {
        const w = budgetWindow(b.period, b.customDays, today, payCalendar)
        return [ymd(w.start), ymd(w.end)] as const
      }),
    )
    const [txns, nodes] = await Promise.all([
      db.transactions
        .where('date')
        .inAnyRange(windows, { includeUppers: true })
        .toArray(),
      db.balanceNodes.toArray(),
    ])
    return { budgets, payCalendar, txns, nodes }
  }, [todayIso])
  const { catalog, loaded } = useCategoryCatalogState()

  return useMemo(
    () =>
      read && loaded
        ? budgetsLeft({ ...read, base, rates }, catalog, startOfToday())
        : NONE,
    [read, loaded, catalog, base, rates],
  )
}
