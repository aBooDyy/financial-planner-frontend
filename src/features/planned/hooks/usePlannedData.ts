import { useSyncExternalStore } from 'react'
import type {
  LocalBalanceNode,
  LocalBalanceSettings,
  LocalExchangeRate,
} from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/goals/constants'
import { startOfToday } from '#/features/goals/data/planning'
import { dateOf, isoOf } from '#/features/planned/data/dates'
import {
  plannerTablesSnapshot,
  subscribePlannerTables,
} from '#/features/planned/data/plannerTables'
import { derivePlannerState, liveInputs } from '#/features/planned/data/state'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { useMergedRates } from '#/lib/config/rates'
import { planningSettingsOf } from '#/features/wallets/data/mappers'
import { useSessionStore } from '#/stores/session'

export type PlannedData = {
  loading: boolean
  userId: string
  /** ISO date the views are computed for. */
  today: string
  todayDate: Date
  inputs: PlannerInputs
  state: PlannerState
  nodes: LocalBalanceNode[]
}

const NONE: never[] = []
const NO_RATE_ROWS: LocalExchangeRate[] = []

/** Remembers the last call's result; the same arguments (by identity) return it again. */
function memoLast<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  let last: { args: TArgs; value: TResult } | null = null
  return (...args: TArgs): TResult => {
    const prev = last
    if (prev && args.every((arg, i) => Object.is(arg, prev.args[i])))
      return prev.value
    const value = fn(...args)
    last = { args, value }
    return value
  }
}

// Shared by every consumer: mounted together, they read the same table arrays, so the
// first one derives and the rest reuse it.
const sharedInputs = memoLast(
  (
    goals: PlannerInputs['goals'],
    income: PlannerInputs['income'],
    bills: PlannerInputs['bills'],
    planned: PlannerInputs['planned'],
    txns: PlannerInputs['txns'],
    setAsides: PlannerInputs['setAsides'],
    settings: LocalBalanceSettings | null,
    base: CurrencyCode,
    ratesKey: string,
  ): PlannerInputs =>
    liveInputs({
      goals,
      income,
      bills,
      planned,
      txns,
      setAsides,
      settings: planningSettingsOf(settings),
      base,
      rates: JSON.parse(ratesKey) as RatesMap,
    }),
)
const sharedState = memoLast(
  (inputs: PlannerInputs, userId: string, today: string): PlannerState =>
    derivePlannerState(inputs, userId, dateOf(today)),
)
const sharedNodes = memoLast((rows: LocalBalanceNode[]) =>
  rows.filter((n) => n.deleted === 0),
)

/**
 * Every planner input, read reactively, and the state derived from it (live plan, desired
 * rows, settlement index). One shared read and one derivation serve every mounted consumer
 * (`data/plannerTables.ts`); recomputed only when a table changes or the day turns.
 */
export function usePlannedData(): PlannedData {
  const userId = useSessionStore((s) => s.user?.id ?? '')
  const tables = useSyncExternalStore(
    subscribePlannerTables,
    plannerTablesSnapshot,
  )
  const rates = useMergedRates(tables.rateRows ?? NO_RATE_ROWS)

  const todayDate = startOfToday()
  const today = isoOf(todayDate)
  const base = tables.settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  const inputs = sharedInputs(
    tables.goals ?? NONE,
    tables.income ?? NONE,
    tables.bills ?? NONE,
    tables.planned ?? NONE,
    tables.txns ?? NONE,
    tables.setAsides ?? NONE,
    tables.settings ?? null,
    base,
    JSON.stringify(rates),
  )

  return {
    loading:
      tables.goals === undefined ||
      tables.planned === undefined ||
      tables.txns === undefined ||
      tables.setAsides === undefined,
    userId,
    today,
    todayDate,
    inputs,
    state: sharedState(inputs, userId, today),
    nodes: sharedNodes(tables.nodes ?? NONE),
  }
}
