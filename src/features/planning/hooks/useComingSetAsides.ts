import { useMemo } from 'react'
import { isSetAsideFor } from '#/features/planned/data/owners'
import type { PlanOwner } from '#/features/planned/data/owners'
import { remainderOf } from '#/features/planned/data/settle'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'

/** An owner's planned set-asides still open, soonest first, with what is left on each. */
export function useComingSetAsides(owner: PlanOwner) {
  const { inputs, state } = usePlannedData()
  return useMemo(
    () =>
      inputs.planned
        .filter(
          (p) =>
            p.deleted === 0 && p.status === 'open' && isSetAsideFor(p, owner),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({
          id: p.id,
          date: p.date,
          amount: remainderOf(p, state.index, inputs.rates),
        })),
    [inputs, state, owner],
  )
}
