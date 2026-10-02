import { useCallback, useMemo } from 'react'
import { billOwner, ownerKey } from '#/features/planned/data/owners'
import { recalcPlan } from '#/features/planned/data/runner'
import type { RecalcResult } from '#/features/planned/data/runner'
import { behindOf } from '#/features/planned/data/settle'
import type { Behind } from '#/features/planned/data/settle'
import { comparePlan } from '#/features/planned/data/views'
import type { PlanCompare } from '#/features/planned/data/views'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { usePlannedData } from './usePlannedData'

export type UseBillPlan = {
  loading: boolean
  /** Null while loading or when the bill does not exist. */
  plan: (PlanCompare & { behind: Behind }) | null
  /** Rewrite the bill's future set-asides to today's numbers. */
  recalc: () => Promise<RecalcResult | null>
  /** The last rewrite of this bill's plan, with its undo. */
  lastRecalc: RecalcResult | null
  dismissRecalc: () => void
}

/** A bill's stored plan next to the live one, and how far behind it is — its detail's Plan box. */
export function useBillPlan(billId: string | null): UseBillPlan {
  const data = usePlannedData()
  const owner = useMemo(() => (billId ? billOwner(billId) : null), [billId])
  const lastRecalc = useRecalcUndoStore((s) =>
    owner ? (s.byOwner[ownerKey(owner)] ?? null) : null,
  )
  const forget = useRecalcUndoStore((s) => s.forget)

  const plan = useMemo(() => {
    const bill = owner
      ? data.inputs.bills.find((b) => b.id === owner.id)
      : undefined
    if (!owner || !bill) return null
    return {
      ...comparePlan({
        owner,
        snapshot: bill,
        desired: data.state.desired,
        planned: data.inputs.planned,
        index: data.state.index,
        rates: data.inputs.rates,
        today: data.today,
      }),
      behind: behindOf(
        owner,
        data.inputs.planned,
        data.state.index,
        data.inputs.rates,
        data.today,
      ),
    }
  }, [owner, data.inputs, data.state, data.today])

  const recalc = useCallback(
    () =>
      owner
        ? recalcPlan(owner, data.userId, data.todayDate)
        : Promise.resolve(null),
    // `todayDate` is keyed by its day.
    [owner, data.userId, data.today],
  )
  const dismissRecalc = useCallback(() => {
    if (owner) forget(owner)
  }, [owner, forget])

  return { loading: data.loading, plan, recalc, lastRecalc, dismissRecalc }
}
