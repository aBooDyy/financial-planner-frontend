import { create } from 'zustand'
import type { RecalcResult } from '#/features/planned/data/runner'

/**
 * The last plan rewrite per goal, kept so the goal detail can offer "Plan updated · Undo"
 * whether the rewrite came from a Recalculate click or from a plan-changing edit the planner
 * wrote through. In memory only: an undo that survived a reload is not worth persisting.
 */
type RecalcUndoState = {
  byGoal: Record<string, RecalcResult>
  remember: (result: RecalcResult) => void
  forget: (goalId: string) => void
}

export const useRecalcUndoStore = create<RecalcUndoState>((set) => ({
  byGoal: {},
  remember: (result) =>
    set((s) => ({ byGoal: { ...s.byGoal, [result.goalId]: result } })),
  forget: (goalId) =>
    set((s) => {
      const { [goalId]: _gone, ...rest } = s.byGoal
      void _gone
      return { byGoal: rest }
    }),
}))
