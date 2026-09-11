import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode, LocalGoal, LocalTransaction } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/balances/constants'
import type { SpendingData } from '#/features/transactions/data/selectors'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Reactive read of every Spending input from the local DB, bundled into the `SpendingData`
 * the pure selectors consume. Wallets/goals are surfaced too so the editor can offer them.
 */
export function useTransactions() {
  const txnRows = useLiveQuery(() => db.transactions.toArray())
  const budgetRows = useLiveQuery(() => db.budgets.toArray())
  const recurringRows = useLiveQuery(() => db.recurrings.toArray())
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())

  const loading =
    txnRows === undefined ||
    budgetRows === undefined ||
    recurringRows === undefined ||
    nodeRows === undefined

  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  const rates: Partial<Record<string, number>> = Object.fromEntries(
    (rateRows ?? []).map((r) => [r.currency, r.rate]),
  )

  const nodes: LocalBalanceNode[] = (nodeRows ?? []).filter(
    (n) => n.deleted === 0,
  )
  const wallets = nodes.filter((n) => n.kind === 'wallet')
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
  }

  return { loading, base, data, wallets, goals, transactions }
}
