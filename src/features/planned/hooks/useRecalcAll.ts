import { useCallback, useMemo } from 'react'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import type { PlanOwner } from '#/features/planned/data/owners'
import { recalcAllPlans } from '#/features/planned/data/runner'
import type { RecalcResult } from '#/features/planned/data/runner'
import { comparePlan } from '#/features/planned/data/views'
import { usePlannedData } from './usePlannedData'

export type UseRecalcAll = {
  /** Goals and bills whose stored plan today's numbers disagree with — "Recalculate all". */
  offPlan: PlanOwner[]
  /** Rewrite every off-plan one; one undo each (also kept in the undo store). */
  recalcAll: () => Promise<RecalcResult[]>
}

export function useRecalcAll(): UseRecalcAll {
  const data = usePlannedData()
  const offPlan = useMemo(() => {
    const { inputs, state, today } = data
    const isOff = (
      owner: PlanOwner,
      snapshot: (typeof inputs.goals)[number] | (typeof inputs.bills)[number],
    ) =>
      comparePlan({
        owner,
        snapshot,
        desired: state.desired,
        planned: inputs.planned,
        index: state.index,
        rates: inputs.rates,
        today,
      }).isOffPlan
    return [
      ...inputs.goals
        .filter((g) => g.closedAt === null && isOff(goalOwner(g.id), g))
        .map((g) => goalOwner(g.id)),
      ...inputs.bills
        .filter((b) => b.closedAt === null && isOff(billOwner(b.id), b))
        .map((b) => billOwner(b.id)),
    ]
  }, [data])
  const recalcAll = useCallback(
    () => recalcAllPlans(offPlan, data.userId, data.todayDate),
    // `todayDate` is keyed by its day.
    [offPlan, data.userId, data.today],
  )
  return { offPlan, recalcAll }
}
