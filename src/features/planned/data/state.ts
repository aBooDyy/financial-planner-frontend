/**
 * Everything the planner works from, read once, and what it derives from that: the live
 * funding plan (with settled progress folded in), the rows that plan calls for today, and
 * the settlement index. The runner and the view hooks share it, so a number on screen is
 * always the number the planner would write.
 */
import type {
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
  LocalPlanned,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { goalProgress, progressByGoal } from '#/features/goals/data/progress'
import type { GoalProgressMap } from '#/features/goals/data/progress'
import { planGoals } from '#/features/goals/data/selectors'
import type { GoalsPlan } from '#/features/goals/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { desiredPlanned } from './generate'
import type { DesiredPlanned } from './generate'
import { indexSettlements, LEGACY_SOURCE_PREFIX } from './settle'
import type { SettlementIndex } from './settle'

export type PlannerInputs = {
  goals: LocalGoal[]
  income: LocalIncomeStream[]
  recurrings: LocalRecurring[]
  planned: LocalPlanned[]
  /** Only transactions linked to a goal, a planned row or a legacy auto-post. */
  txns: LocalTransaction[]
  allocations: LocalGoalAllocation[]
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
  recurrings: live(inputs.recurrings),
  planned: live(inputs.planned),
  txns: live(inputs.txns),
  allocations: live(inputs.allocations),
})

export function derivePlannerState(
  inputs: PlannerInputs,
  userId: string,
  today: Date,
): PlannerState {
  const { goals, income, recurrings, planned, txns, allocations, base, rates } =
    inputs
  const progress = goalProgress(goals, allocations, txns, rates, today, planned)
  const plan = planGoals(
    income,
    goals,
    base,
    rates,
    today,
    progressByGoal(progress),
  )
  const legacyMarkers = new Set(
    txns
      .map((t) => t.source)
      .filter((s): s is string => !!s && s.startsWith(LEGACY_SOURCE_PREFIX)),
  )
  const desired = desiredPlanned({
    userId,
    goals: plan.entries.map((e) => e.goal).concat(plan.completed),
    income,
    recurrings,
    plan,
    base,
    rates,
    today,
    legacyMarkers,
  })
  return { plan, progress, desired, index: indexSettlements(txns, allocations) }
}
