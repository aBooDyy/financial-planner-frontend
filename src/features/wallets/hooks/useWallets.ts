import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { activeNodes, isArchived } from '#/features/wallets/data/archive'
import {
  buildWalletsView,
  heldCurrencies,
} from '#/features/wallets/data/selectors'
import { readLedgerSummary } from '#/features/transactions/data/ledgerReads'
import { walletReservations } from '#/features/goals/data/reservations'
import { startOfToday } from '#/features/goals/data/planning'
import { useStableRates } from '#/hooks/useStableRates'
import type { CurrencyCode } from '#/lib/currency'

const NONE: Record<string, never> = {}

/**
 * Reactive read of the whole Wallets view from the local DB. Re-renders instantly on local
 * writes and on sync-applied server changes — no remote fetching here.
 *
 * `loading` is true until the nodes are known (the tree can draw); `balancesLoading` until
 * every input a figure derives from has landed — the ledger, the goals and their set-asides,
 * the planned rows, the rates and the base currency. Until then the view carries the tree
 * with no deltas and no reservations, and its figures must not be shown.
 */
export function useWallets() {
  const nodes = useLiveQuery(() => db.balanceNodes.toArray())
  // `null`, not `undefined`, when there is no row — so "no settings" is not "still loading".
  const settings = useLiveQuery(
    async () => (await db.balanceSettings.get(SETTINGS_KEY)) ?? null,
  )
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const allocationRows = useLiveQuery(() => db.goalAllocations.toArray())
  const plannedRows = useLiveQuery(() => db.plannedTransactions.toArray())
  const rates = useStableRates(rateRows)
  const ratesReady = rateRows !== undefined
  const ledger = useLiveQuery(
    () => (ratesReady ? readLedgerSummary(rates) : undefined),
    [ratesReady, rates],
  )

  const loading = nodes === undefined
  const balancesLoading =
    loading ||
    settings === undefined ||
    !ratesReady ||
    goalRows === undefined ||
    allocationRows === undefined ||
    plannedRows === undefined ||
    ledger === undefined
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  const liveNodes: LocalBalanceNode[] = (nodes ?? []).filter(
    (n) => n.deleted === 0,
  )
  // Transactions are the ledger: their signed deltas, summed in the query, fold into balances.
  const deltas = balancesLoading ? NONE : ledger.deltas
  // Goal set-asides earmark part of each wallet — until a goal payment consumes them.
  const liveGoals = (goalRows ?? []).filter((g) => g.deleted === 0)
  const reservations = balancesLoading
    ? NONE
    : walletReservations(
        allocationRows,
        liveGoals,
        liveNodes,
        rates,
        ledger.goalLinked,
        startOfToday(),
        plannedRows,
      )
  // Archived nodes keep their ledger and earmarks but leave the tree and its totals.
  const active = activeNodes(liveNodes)
  const view = buildWalletsView(active, base, rates, deltas, reservations)
  const held = heldCurrencies(base, [
    liveNodes,
    liveGoals,
    (ledger?.currencies ?? []).map((currency) => ({ currency })),
    allocationRows ?? [],
    rateRows ?? [],
  ])

  return {
    loading,
    balancesLoading,
    base,
    rates,
    rateRows: rateRows ?? [],
    held,
    nodes: active,
    archivedCount: liveNodes.filter(isArchived).length,
    deltas,
    view,
  }
}
