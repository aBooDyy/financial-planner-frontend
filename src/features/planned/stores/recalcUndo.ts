import { create } from 'zustand'
import { ownerKey } from '#/features/planned/data/owners'
import type { PlanOwner } from '#/features/planned/data/owners'
import type { RecalcResult } from '#/features/planned/data/runner'

/**
 * The last plan rewrite per goal or bill (`goal:<id>` / `bill:<id>`), kept so its detail can
 * offer "Plan updated · Undo" whether the rewrite came from a Recalculate click or from a
 * plan-changing edit the planner wrote through. In memory only: an undo that survived a reload
 * is not worth persisting.
 */
type RecalcUndoState = {
  byOwner: Record<string, RecalcResult>
  remember: (result: RecalcResult) => void
  forget: (owner: PlanOwner) => void
}

export const useRecalcUndoStore = create<RecalcUndoState>((set) => ({
  byOwner: {},
  remember: (result) =>
    set((s) => ({
      byOwner: { ...s.byOwner, [ownerKey(result.owner)]: result },
    })),
  forget: (owner) =>
    set((s) => {
      const { [ownerKey(owner)]: _gone, ...rest } = s.byOwner
      void _gone
      return { byOwner: rest }
    }),
}))
