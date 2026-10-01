/**
 * Everything the planner works from, read once, and what it derives from that: the live
 * funding plan (with settled progress folded in), the rows that plan calls for today, and
 * the settlement index. The runner and the view hooks share it, so a number on screen is
 * always the number the planner would write.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { planGoals } from '#/features/goals/data/fundingPlan'
import type { GoalsPlan } from '#/features/goals/data/fundingPlan'
import { goalProgress, progressByGoal } from '#/features/goals/data/progress'
import type { GoalProgressMap } from '#/features/goals/data/progress'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
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
  base: CurrencyCode
  rates: RatesMap
}

export type PlannerState = {
  plan: GoalsPlan
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
  today: Date,
): PlannerState {
  const { goals, income, txns, setAsides, base, rates } = inputs
  const progress = goalProgress(goals, setAsides, txns, rates)
  const plan = planGoals(
    income,
    goals,
    base,
    rates,
    today,
    progressByGoal(progress),
  )
  const desired = desiredPlanned({ userId, income, plan, base, rates, today })
  return { plan, progress, desired, index: indexSettlements(txns, setAsides) }
}
