import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/balances/constants'
import {
  buildBalancesView,
  heldCurrencies,
} from '#/features/balances/data/selectors'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { walletReservations } from '#/features/goals/data/reservations'
import { startOfToday } from '#/features/goals/data/planning'
import { useMergedRates } from '#/lib/config/rates'
import type { RatesMap } from '#/lib/config/rates'
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
  const plannedRows = useLiveQuery(() => db.plannedTransactions.toArray())

  const loading = nodes === undefined || rateRows === undefined
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  // One rates map: the config's shipped defaults with the user's overrides on top.
  const rates: RatesMap = useMergedRates(rateRows ?? [])

  const liveNodes: LocalBalanceNode[] = (nodes ?? []).filter(
    (n) => n.deleted === 0,
  )
  // Transactions are the ledger: fold their signed deltas into wallet balances.
  const deltas = walletDeltas(liveNodes, txnRows ?? [], rates)
  // Goal set-asides earmark part of each wallet — until a goal payment consumes them.
  const liveGoals = (goalRows ?? []).filter((g) => g.deleted === 0)
  const reservations = walletReservations(
    allocationRows ?? [],
    liveGoals,
    liveNodes,
    rates,
    txnRows ?? [],
    startOfToday(),
    plannedRows ?? [],
  )
  const view = buildBalancesView(liveNodes, base, rates, deltas, reservations)
  const held = heldCurrencies(base, [
    liveNodes,
    liveGoals,
    txnRows ?? [],
    allocationRows ?? [],
    rateRows ?? [],
  ])

  return {
    loading,
    base,
    rates,
    rateRows: rateRows ?? [],
    held,
    settings,
    nodes: liveNodes,
    deltas,
    view,
  }
}
