import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
} from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/goals/constants'
import { buildGoalsView } from '#/features/goals/data/selectors'
import { startOfToday } from '#/features/goals/data/planning'
import {
  contributionsByGoal,
  walletLiveBalances,
} from '#/features/transactions/data/ledger'
import { allocationsByGoal } from '#/features/goals/data/reservations'
import { usePreferencesStore } from '#/stores/preferences'
import { useMergedRates } from '#/lib/config/rates'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Reactive read of the whole Goals planning view from the local DB. Re-renders instantly on
 * local writes and on sync-applied server changes — no remote fetching here.
 */
export function useGoals() {
  const incomeRows = useLiveQuery(() => db.incomeStreams.toArray())
  const goalRows = useLiveQuery(() => db.goals.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const txnRows = useLiveQuery(() => db.transactions.toArray())
  const allocationRows = useLiveQuery(() => db.goalAllocations.toArray())
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  const loading =
    incomeRows === undefined || goalRows === undefined || rateRows === undefined
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  // One rates map: the config's shipped defaults with the user's overrides on top.
  const rates: RatesMap = useMergedRates(rateRows ?? [])

  const income: LocalIncomeStream[] = (incomeRows ?? []).filter(
    (s) => s.deleted === 0,
  )
  const goals: LocalGoal[] = (goalRows ?? []).filter((g) => g.deleted === 0)
  const nodes: LocalBalanceNode[] = (nodeRows ?? []).filter(
    (n) => n.deleted === 0,
  )
  const liveAllocations: LocalGoalAllocation[] = (allocationRows ?? []).filter(
    (a) => a.deleted === 0,
  )
  // Goal-linked transactions raise saved progress (derived, persisted as ledger rows).
  const contributions = contributionsByGoal(goals, txnRows ?? [], rates)
  // Sourced reserves (wallet/external) also count toward saved progress.
  const allocations = allocationsByGoal(liveAllocations, goals, rates)
  // Live wallet balances (opening + txns), so the editor can warn on over-reserving.
  const walletBalances = walletLiveBalances(nodes, txnRows ?? [], rates)
  const view = buildGoalsView(
    income,
    goals,
    base,
    rates,
    startOfToday(),
    contributions,
    dateFormat,
    allocations,
  )

  return {
    loading,
    base,
    rates,
    income,
    goals,
    view,
    nodes,
    allocations: liveAllocations,
    walletBalances,
  }
}
