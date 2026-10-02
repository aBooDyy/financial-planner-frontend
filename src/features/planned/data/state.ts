/**
 * Everything the planner works from, read once, and what it derives from that: goal
 * progress, the settlement index, the funding plan, and the rows that plan calls for today.
 * The runner and the view hooks share it, so a number on screen is always the number the
 * planner would write.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { goalProgress, progressByGoal } from '#/features/goals/data/progress'
import type { GoalProgressMap } from '#/features/goals/data/progress'
import { planFunding } from '#/features/planning/data/funding'
import type { FundingPlan } from '#/features/planning/data/funding'
import type { PlanningSettings } from '#/features/wallets/api/types'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { isoOf } from './dates'
import { desiredPlanned } from './generate'
import type { DesiredPlanned } from './generate'
import { indexSettlements } from './settle'
import type { SettlementIndex } from './settle'

export type PlannerInputs = {
  goals: LocalGoal[]
  income: LocalIncomeStream[]
  bills: LocalBill[]
  planned: LocalPlanned[]
  /** Only transactions linked to a goal, a bill or a planned row. */
  txns: LocalTransaction[]
  setAsides: LocalSetAside[]
  settings: PlanningSettings
  base: CurrencyCode
  rates: RatesMap
}

export type PlannerState = {
  funding: FundingPlan
  progress: GoalProgressMap
  desired: DesiredPlanned[]
  index: SettlementIndex
}

const live = <T extends { deleted: 0 | 1 }>(rows: ReadonlyArray<T>): T[] =>
  rows.filter((r) => r.deleted === 0)

/** Drop soft-deleted rows so every derivation below sees the same live set. */
export const liveInputs = (inputs: PlannerInputs): PlannerInputs => ({
  ...inputs,
  goals: live(inputs.goals),
  income: live(inputs.income),
  bills: live(inputs.bills),
  planned: live(inputs.planned),
  txns: live(inputs.txns),
  setAsides: live(inputs.setAsides),
})

export function derivePlannerState(
  inputs: PlannerInputs,
  userId: string,
  todayDate: Date,
): PlannerState {
  const today = isoOf(todayDate)
  const { goals, income, bills, txns, setAsides, base, rates } = inputs
  const progress = goalProgress(goals, setAsides, txns, rates)
  const index = indexSettlements(txns, setAsides)
  const funding = planFunding({
    bills,
    goals,
    income,
    planned: inputs.planned,
    setAsides,
    progress: progressByGoal(progress),
    index,
    settings: inputs.settings,
    base,
    rates,
    today,
  })
  const desired = desiredPlanned({
    userId,
    income,
    bills,
    goals,
    funding,
    paydayMode: inputs.settings.paydayMode,
    today,
  })
  return { funding, progress, desired, index }
}
