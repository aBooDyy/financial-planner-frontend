import { useCallback, useMemo } from 'react'
import { addContribution } from '#/features/planned/data/mutations'
import type {
  ContributionInput,
  ContributionResult,
} from '#/features/planned/data/mutations'
import { recalcGoalPlan } from '#/features/planned/data/runner'
import type { RecalcResult } from '#/features/planned/data/runner'
import { buildGoalPlanView } from '#/features/planned/data/views'
import type { GoalPlanView } from '#/features/planned/data/views'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { usePlannedData } from './usePlannedData'

export type UseGoalPlan = {
  loading: boolean
  /** Null while loading or when the goal does not exist. */
  view: GoalPlanView | null
  /** Rewrite the goal's future rows to today's numbers. Resolves with the undo handle. */
  recalc: () => Promise<RecalcResult | null>
  /** The last rewrite of this goal (a Recalculate, or a plan-changing edit), with its undo. */
  lastRecalc: RecalcResult | null
  /** Hide the "Plan updated · Undo" band (the panel closed, or the user moved on). */
  dismissRecalc: () => void
  addContribution: (input: ContributionInput) => Promise<ContributionResult>
}

/** A goal's stored plan next to the live one, how far behind it is, and its contributions. */
export function useGoalPlan(goalId: string | null): UseGoalPlan {
  const data = usePlannedData()
  const lastRecalc = useRecalcUndoStore((s) =>
    goalId ? (s.byGoal[goalId] ?? null) : null,
  )
  const forget = useRecalcUndoStore((s) => s.forget)

  const view = useMemo(() => {
    const goal = goalId
      ? data.inputs.goals.find((g) => g.id === goalId)
      : undefined
    if (!goal) return null
    return buildGoalPlanView({
      goal,
      planned: data.inputs.planned,
      desired: data.state.desired,
      txns: data.inputs.txns,
      setAsides: data.inputs.setAsides,
      progress: data.state.progress[goal.id],
      nodes: data.nodes,
      index: data.state.index,
      rates: data.inputs.rates,
      today: data.today,
    })
  }, [goalId, data.inputs, data.state, data.nodes, data.today])

  const recalc = useCallback(
    () =>
      goalId
        ? recalcGoalPlan(goalId, data.userId, data.todayDate)
        : Promise.resolve(null),
    // `todayDate` is keyed by its day.
    [goalId, data.userId, data.today],
  )
  const dismissRecalc = useCallback(() => {
    if (goalId) forget(goalId)
  }, [goalId, forget])
  const contribute = useCallback(
    (input: ContributionInput) => {
      if (!goalId) return Promise.reject(new Error('planned.not_found'))
      return addContribution(goalId, input)
    },
    [goalId],
  )

  return {
    loading: data.loading,
    view,
    recalc,
    lastRecalc,
    dismissRecalc,
    addContribution: contribute,
  }
}
