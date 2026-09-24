import { useState } from 'react'
import { useRecalcUndoStore } from '#/features/planned'

/**
 * Which goal's read view is open. The "Plan updated · Undo" band lives until the panel closes
 * or moves to another goal (04 §5), so leaving a goal drops its undo.
 */
export function useGoalDetail() {
  const [goalId, setGoalId] = useState<string | null>(null)
  const forget = useRecalcUndoStore((s) => s.forget)

  const leave = (next: string | null) => {
    if (goalId && goalId !== next) forget(goalId)
    setGoalId(next)
  }

  return {
    goalId,
    open: (id: string) => leave(id),
    close: () => leave(null),
  }
}
