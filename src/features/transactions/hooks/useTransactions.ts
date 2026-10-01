import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { hiddenByArchive } from '#/features/wallets/data/archive'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { readWalletDeltas } from '#/features/transactions/data/ledgerReads'
import type { SpendingInputs } from '#/features/transactions/data/selectors'
import { useStableRates } from '#/hooks/useStableRates'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Reactive read of every Spending input except the ledger rows (a page reads those for its
 * period through `useLedgerWindow`), plus each wallet's delta over the whole ledger and the
 * category catalog the selectors resolve names, colours and icons through. Every value is
 * memoized on its source rows, so it only changes when they do.
 */
export function useTransactions() {
  const budgetRows = useLiveQuery(() => db.budgets.toArray())
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const billRows = useLiveQuery(() => db.bills.toArray())
  const setAsideRows = useLiveQuery(() => db.setAsides.toArray())
  // `null`, not `undefined`, when there is no row — so "no settings" is not "still loading".
  const settings = useLiveQuery(
    async () => (await db.balanceSettings.get(SETTINGS_KEY)) ?? null,
  )
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const { catalog, loaded: catalogLoaded } = useCategoryCatalogState()
  const rates = useStableRates(rateRows)
  const ratesReady = rateRows !== undefined
  const deltas = useLiveQuery(
    () => (ratesReady ? readWalletDeltas(rates) : undefined),
    [ratesReady, rates],
  )

  const loading =
    budgetRows === undefined ||
    nodeRows === undefined ||
    goalRows === undefined ||
    billRows === undefined ||
    setAsideRows === undefined ||
    settings === undefined ||
    !ratesReady ||
    !catalogLoaded

  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  const accounts = useMemo(() => {
    const nodes = (nodeRows ?? []).filter((n) => n.deleted === 0)
    const hidden = hiddenByArchive(nodes)
    const allWallets = nodes.filter((n) => n.kind === 'wallet')
    // New entries go to live accounts; an archived one only resolves an existing row.
    const wallets = allWallets.filter((w) => !hidden.has(w.id))
    const editorWallets = [
      ...wallets,
      ...allWallets.filter((w) => hidden.has(w.id)),
    ]
    return { nodes, hidden, wallets, editorWallets }
  }, [nodeRows])

  const goals = useMemo(
    () => (goalRows ?? []).filter((g) => g.deleted === 0),
    [goalRows],
  )
  const bills = useMemo(
    () => (billRows ?? []).filter((b) => b.deleted === 0),
    [billRows],
  )

  const inputs = useMemo(
    (): SpendingInputs => ({
      budgets: budgetRows ?? [],
      nodes: accounts.nodes,
      base,
      rates,
      setAsides: setAsideRows ?? [],
      goals,
      bills,
    }),
    [budgetRows, accounts, base, rates, setAsideRows, goals, bills],
  )

  return {
    loading,
    base,
    inputs,
    deltas,
    catalog,
    wallets: accounts.wallets,
    editorWallets: accounts.editorWallets,
    archivedWalletIds: accounts.hidden,
    goals,
  }
}
