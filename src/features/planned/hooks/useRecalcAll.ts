import { useCallback, useMemo } from 'react'
import { recalcAllPlans } from '#/features/planned/data/runner'
import type { RecalcResult } from '#/features/planned/data/runner'
import { buildGoalPlanView } from '#/features/planned/data/views'
import { usePlannedData } from './usePlannedData'

export type UseRecalcAll = {
  /** Goals whose stored plan today's numbers disagree with — Summary's "Recalculate all". */
  offPlanGoalIds: string[]
  /** Rewrite every off-plan goal; one undo per goal (also kept in the undo store). */
  recalcAll: () => Promise<RecalcResult[]>
}

export function useRecalcAll(): UseRecalcAll {
  const data = usePlannedData()
  const offPlanGoalIds = useMemo(
    () =>
      data.inputs.goals
        .filter(
          (goal) =>
            buildGoalPlanView({
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
            }).isOffPlan,
        )
        .map((goal) => goal.id),
    [data.inputs, data.state, data.nodes, data.today],
  )
  const recalcAll = useCallback(
    () => recalcAllPlans(offPlanGoalIds, data.userId, data.todayDate),
    // `todayDate` is keyed by its day.
    [offPlanGoalIds, data.userId, data.today],
  )
  return { offPlanGoalIds, recalcAll }
}
