import { useDeferredValue, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { indexSearch, searchIndex } from '#/features/search/data/search'
import type {
  SearchContext,
  SearchFilters,
  SearchView,
} from '#/features/search/data/types'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { useStableRates } from '#/hooks/useStableRates'
import { useSearchBasics } from './useSearchBasics'

const whenEnabled = async <T>(
  enabled: boolean,
  read: () => Promise<T>,
): Promise<T | undefined> => (enabled ? read() : undefined)

type Args = {
  query: string
  filters: SearchFilters
  /** Everywhere; false narrows to `context`. */
  wide: boolean
  /** The Spending tab and scope on screen; null elsewhere, which always searches wide. */
  context: SearchContext | null
  /** False while the search is closed: nothing is read. */
  enabled: boolean
}

/**
 * Search over the whole local dataset — every ledger row, not a page's window. The index is
 * rebuilt only when a source table writes; each keystroke just filters it, and the query is
 * deferred so typing never waits on that.
 */
export function useSearchView({
  query,
  filters,
  wide,
  context,
  enabled,
}: Args): { loading: boolean; view: SearchView | null } {
  const basics = useSearchBasics(enabled)
  const txns = useLiveQuery(
    () => whenEnabled(enabled, () => db.transactions.toArray()),
    [enabled],
  )
  const planned = useLiveQuery(
    () =>
      whenEnabled(enabled, () =>
        db.plannedTransactions.where('status').equals('open').toArray(),
      ),
    [enabled],
  )
  const budgets = useLiveQuery(
    () => whenEnabled(enabled, () => db.budgets.toArray()),
    [enabled],
  )
  const recurrings = useLiveQuery(
    () => whenEnabled(enabled, () => db.recurrings.toArray()),
    [enabled],
  )
  const merchants = useLiveQuery(
    () => whenEnabled(enabled, () => db.merchants.toArray()),
    [enabled],
  )
  const rateRows = useLiveQuery(
    () => whenEnabled(enabled, () => db.exchangeRates.toArray()),
    [enabled],
  )
  const rates = useStableRates(rateRows)
  const { nodeRows, base, catalog, dateFormat } = basics

  const index = useMemo(() => {
    if (
      !txns ||
      !planned ||
      !budgets ||
      !recurrings ||
      !merchants ||
      !nodeRows ||
      !rateRows
    )
      return null
    return indexSearch(
      {
        txns,
        planned,
        budgets,
        recurrings,
        nodes: nodeRows,
        merchants,
        base,
        rates,
        catalog,
      },
      dateFormat,
    )
  }, [
    txns,
    planned,
    budgets,
    recurrings,
    merchants,
    nodeRows,
    rateRows,
    base,
    rates,
    catalog,
    dateFormat,
  ])

  const deferredQuery = useDeferredValue(query)
  const today = ymd(startOfToday())
  const view = useMemo(
    () =>
      index && !basics.loading
        ? searchIndex(index, {
            query: deferredQuery,
            filters,
            wide,
            context,
            today,
          })
        : null,
    [index, basics.loading, deferredQuery, filters, wide, context, today],
  )

  return { loading: enabled && view === null, view: enabled ? view : null }
}
