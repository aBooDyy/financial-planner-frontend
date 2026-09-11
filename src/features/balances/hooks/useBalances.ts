import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/balances/constants'
import { buildBalancesView } from '#/features/balances/data/selectors'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { walletReservations } from '#/features/goals/data/reservations'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Reactive read of the whole Balances view from the local DB. Re-renders instantly on local
 * writes and on sync-applied server changes — no remote fetching here.
 */
export function useBalances() {
  const nodes = useLiveQuery(() => db.balanceNodes.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const txnRows = useLiveQuery(() => db.transactions.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const allocationRows = useLiveQuery(() => db.goalAllocations.toArray())

  const loading = nodes === undefined || rateRows === undefined
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  const rates: Partial<Record<string, number>> = Object.fromEntries(
    (rateRows ?? []).map((r) => [r.currency, r.rate]),
  )

  const liveNodes: LocalBalanceNode[] = (nodes ?? []).filter(
    (n) => n.deleted === 0,
  )
  // Transactions are the ledger: fold their signed deltas into wallet balances.
  const deltas = walletDeltas(liveNodes, txnRows ?? [], rates)
  // Goal allocations earmark part of each wallet: split into reserved vs available.
  const liveGoals = (goalRows ?? []).filter((g) => g.deleted === 0)
  const reservations = walletReservations(
    allocationRows ?? [],
    liveGoals,
    liveNodes,
    rates,
  )
  const view = buildBalancesView(liveNodes, base, rates, deltas, reservations)

  return {
    loading,
    base,
    rates,
    rateRows: rateRows ?? [],
    settings,
    nodes: liveNodes,
    view,
  }
}
