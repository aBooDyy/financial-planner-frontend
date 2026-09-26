import { useMemo, useState } from 'react'
import type { TxType } from '#/features/transactions/api/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  defaultMoveTarget,
  moveTargetsFor,
} from '#/features/categories/data/moveTargets'
import type { MoveTarget } from '#/features/categories/data/moveTargets'

export type DeleteTarget = {
  id: string
  name: string
  type: TxType
  /** The parent of a subcategory; `null` for a category. */
  parentId: string | null
  subCount: number
  txCount: number
  recurringCount: number
  plannedCount: number
}

export type DeleteChoice = {
  /** Whether anything is filed under the category — only then must it move somewhere. */
  hasFiled: boolean
  targets: MoveTarget[]
  moveTo: string | null
  setMoveTo: (id: string) => void
  /** The id to move into, or `null` when nothing is filed. */
  resolvedMoveTo: string | null
  /** Filed rows with nowhere chosen to go: the delete can't proceed. */
  blocked: boolean
}

type State = { forId: string | null; moveTo: string | null }

export const filedCount = (t: DeleteTarget): number =>
  t.txCount + t.recurringCount + t.plannedCount

/**
 * The delete dialog's decision: where what the category files moves to. A category in use
 * can't be deleted without a target. It resets to the suggested target whenever the dialog
 * opens on another row.
 */
export function useDeleteChoice(
  target: DeleteTarget | null,
  catalog: CategoryCatalog,
): DeleteChoice {
  const targets = useMemo(
    () => (target ? moveTargetsFor(catalog, target) : []),
    [catalog, target],
  )
  const [state, setState] = useState<State>({ forId: null, moveTo: null })

  if (target && state.forId !== target.id) {
    const moveTo = defaultMoveTarget(catalog, targets, target.parentId)
    setState({ forId: target.id, moveTo })
  }

  const hasFiled = target !== null && filedCount(target) > 0
  const resolvedMoveTo = hasFiled ? state.moveTo : null

  return {
    hasFiled,
    targets,
    moveTo: state.moveTo,
    setMoveTo: (moveTo) => setState((s) => ({ ...s, moveTo })),
    resolvedMoveTo,
    blocked: hasFiled && resolvedMoveTo === null,
  }
}
