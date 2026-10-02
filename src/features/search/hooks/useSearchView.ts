import { useDeferredValue, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import {
  idleSearchView,
  indexSearch,
  isSearchActive,
  searchIndex,
} from '#/features/search/data/search'
import type {
  SearchContext,
  SearchFilters,
  SearchView,
} from '#/features/search/data/types'
import { readWalletDeltas } from '#/features/transactions/data/ledgerReads'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { useStableRates } from '#/hooks/useStableRates'
import { useSearchBasics } from './useSearchBasics'

const whenEnabled = async <T>(
  enabled: boolean,
  load: () => Promise<T>,
): Promise<T | undefined> => (enabled ? load() : undefined)

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
 * Search over the whole local dataset — every ledger row, not a page's window. Nothing is read
 * until there is something to search for, so opening costs nothing; from then on the data stays
 * loaded while the sheet is open. The index is rebuilt only when a source table writes; each
 * keystroke just filters it, and the query is deferred so typing never waits on that.
 */
export function useSearchView({
  query,
  filters,
  wide,
  context,
  enabled,
}: Args): { loading: boolean; view: SearchView | null } {
  const active = isSearchActive(query, filters)
  const [asked, setAsked] = useState(false)
  if (enabled && active && !asked) setAsked(true)
  const read = enabled && asked
  const basics = useSearchBasics(read)
  const txns = useLiveQuery(
    () => whenEnabled(read, () => db.transactions.toArray()),
    [read],
  )
  const planned = useLiveQuery(
    () =>
      whenEnabled(read, () =>
        db.plannedTransactions.where('status').equals('open').toArray(),
      ),
    [read],
  )
  const budgets = useLiveQuery(
    () => whenEnabled(read, () => db.budgets.toArray()),
    [read],
  )
  const bills = useLiveQuery(
    () => whenEnabled(read, () => db.bills.toArray()),
    [read],
  )
  const goals = useLiveQuery(
    () => whenEnabled(read, () => db.goals.toArray()),
    [read],
  )
  const merchants = useLiveQuery(
    () => whenEnabled(read, () => db.merchants.toArray()),
    [read],
  )
  const rateRows = useLiveQuery(
    () => whenEnabled(read, () => db.exchangeRates.toArray()),
    [read],
  )
  const rates = useStableRates(rateRows)
  const ratesReady = rateRows !== undefined
  const deltas = useLiveQuery(
    () => whenEnabled(read && ratesReady, () => readWalletDeltas(rates)),
    [read, ratesReady, rates],
  )
  const { nodeRows, base, catalog, dateFormat } = basics

  const index = useMemo(() => {
    if (
      !txns ||
      !planned ||
      !bills ||
      !goals ||
      !budgets ||
      !merchants ||
      !nodeRows ||
      !rateRows ||
      !deltas
    )
      return null
    return indexSearch(
      {
        txns,
        planned,
        bills,
        goals,
        budgets,
        nodes: nodeRows,
        merchants,
        deltas,
        base,
        rates,
        catalog,
      },
      dateFormat,
    )
  }, [
    txns,
    planned,
    bills,
    goals,
    budgets,
    merchants,
    nodeRows,
    rateRows,
    deltas,
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

  if (!enabled) return { loading: false, view: null }
  if (!active)
    return {
      loading: false,
      view: idleSearchView({ wide, context, filters }, dateFormat),
    }
  return { loading: view === null, view }
}
