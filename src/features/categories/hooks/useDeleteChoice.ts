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
}

export type DeleteMode = 'move' | 'keep'

export type DeleteChoice = {
  /** Whether anything is filed under the category — only then is there a choice to make. */
  hasFiled: boolean
  targets: MoveTarget[]
  mode: DeleteMode
  setMode: (mode: DeleteMode) => void
  moveTo: string | null
  setMoveTo: (id: string) => void
  /** The id to move into, or `null` to keep the rows' labels as they are. */
  resolvedMoveTo: string | null
}

type State = { forId: string | null; mode: DeleteMode; moveTo: string | null }

/**
 * The delete dialog's decision: move what the category files, and where to, or keep it
 * as it is. It resets to the suggested target whenever the dialog opens on another row.
 */
export function useDeleteChoice(
  target: DeleteTarget | null,
  catalog: CategoryCatalog,
): DeleteChoice {
  const targets = useMemo(
    () => (target ? moveTargetsFor(catalog, target) : []),
    [catalog, target],
  )
  const [state, setState] = useState<State>({
    forId: null,
    mode: 'move',
    moveTo: null,
  })

  if (target && state.forId !== target.id) {
    const moveTo = defaultMoveTarget(catalog, targets, target.parentId)
    setState({ forId: target.id, mode: moveTo ? 'move' : 'keep', moveTo })
  }

  const hasFiled = target !== null && target.txCount + target.recurringCount > 0

  return {
    hasFiled,
    targets,
    mode: state.mode,
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    moveTo: state.moveTo,
    setMoveTo: (moveTo) => setState((s) => ({ ...s, moveTo })),
    resolvedMoveTo: hasFiled && state.mode === 'move' ? state.moveTo : null,
  }
}
