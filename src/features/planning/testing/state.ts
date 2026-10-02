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

/**
 * The same scenario once the planner has written what the plan calls for: its desired rows
 * stored (alongside any given), and the state derived again over them.
 */
export function plannedScenario(s: Scenario): ReturnType<typeof scenario> {
  const first = scenario(s)
  const held = new Set((s.planned ?? []).map((p) => p.id))
  const written: LocalPlanned[] = first.state.desired
    .filter((d) => !held.has(d.id))
    .map((d) => ({
      ...d,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    }))
  return scenario({ ...s, planned: [...(s.planned ?? []), ...written] })
}
