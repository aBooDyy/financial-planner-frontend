/**
 * Planner inputs and state for the planning slice's tests. Test-only: nothing in the app
 * imports this.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { dateOf } from '#/features/planned/data/dates'
import { derivePlannerState, liveInputs } from '#/features/planned/data/state'
import type { PlannerInputs, PlannerState } from '#/features/planned/data/state'
import { RATES } from '#/features/planned/testing/fixtures'
import { DEFAULT_PLANNING_SETTINGS } from '#/features/wallets/api/types'
import type { PlanningSettings } from '#/features/wallets/api/types'

export type Scenario = {
  bills?: LocalBill[]
  goals?: LocalGoal[]
  income?: LocalIncomeStream[]
  planned?: LocalPlanned[]
  setAsides?: LocalSetAside[]
  txns?: LocalTransaction[]
  settings?: Partial<PlanningSettings>
  /** ISO date. */
  today: string
}

export function scenario(s: Scenario): {
  inputs: PlannerInputs
  state: PlannerState
  today: string
} {
  const inputs = liveInputs({
    goals: s.goals ?? [],
    income: s.income ?? [],
    bills: s.bills ?? [],
    planned: s.planned ?? [],
    txns: s.txns ?? [],
    setAsides: s.setAsides ?? [],
    settings: { ...DEFAULT_PLANNING_SETTINGS, ...s.settings },
    base: 'SAR',
    rates: RATES,
  })
  return {
    inputs,
    state: derivePlannerState(inputs, 'u1', dateOf(s.today)),
    today: s.today,
  }
}
