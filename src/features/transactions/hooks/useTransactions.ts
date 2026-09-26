import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode, LocalGoal, LocalTransaction } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { hiddenByArchive } from '#/features/wallets/data/archive'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { SpendingData } from '#/features/transactions/data/selectors'
import { useMergedRates } from '#/lib/config/rates'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Reactive read of every Spending input from the local DB, bundled into the `SpendingData`
 * the pure selectors consume, plus the category catalog they resolve names, colours and
 * icons through. Wallets/goals are surfaced too so the editor can offer them.
 */
export function useTransactions() {
  const txnRows = useLiveQuery(() => db.transactions.toArray())
  const budgetRows = useLiveQuery(() => db.budgets.toArray())
  const recurringRows = useLiveQuery(() => db.recurrings.toArray())
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const allocationRows = useLiveQuery(() => db.goalAllocations.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const catalog = useCategoryCatalog()

  const loading =
    txnRows === undefined ||
    budgetRows === undefined ||
    recurringRows === undefined ||
    nodeRows === undefined

  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  // One rates map: the config's shipped defaults with the user's overrides on top.
  const rates: RatesMap = useMergedRates(rateRows ?? [])

  const nodes: LocalBalanceNode[] = (nodeRows ?? []).filter(
    (n) => n.deleted === 0,
  )
  const hidden = hiddenByArchive(nodes)
  const allWallets = nodes.filter((n) => n.kind === 'wallet')
  // New entries go to live accounts; an archived one only resolves an existing row.
  const wallets = allWallets.filter((w) => !hidden.has(w.id))
  const editorWallets = [
    ...wallets,
    ...allWallets.filter((w) => hidden.has(w.id)),
  ]
  const goals: LocalGoal[] = (goalRows ?? []).filter((g) => g.deleted === 0)
  const transactions: LocalTransaction[] = (txnRows ?? []).filter(
    (t) => t.deleted === 0,
  )

  const data: SpendingData = {
    txns: txnRows ?? [],
    budgets: budgetRows ?? [],
    recurrings: recurringRows ?? [],
    nodes,
    base,
    rates,
    allocations: allocationRows ?? [],
    goals,
  }

  return {
    loading,
    base,
    data,
    catalog,
    wallets,
    editorWallets,
    archivedWalletIds: hidden,
    goals,
    transactions,
  }
}
