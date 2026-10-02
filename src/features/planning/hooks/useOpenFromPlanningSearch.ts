import { useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { parsePlanningOpen } from '#/features/planning/data/openParam'
import type { PlanningOpenIntent } from '#/features/planning/data/openParam'
import { usePlanningUi } from '#/features/planning/stores/planningUi'

/** Opens what an intent names: a detail panel, the income editor or a confirm dialog. */
export function openPlanningIntent(intent: PlanningOpenIntent): void {
  const ui = usePlanningUi.getState()
  switch (intent.kind) {
    case 'bill':
      ui.openDetail(billOwner(intent.id))
      return
    case 'goal':
      ui.openDetail(goalOwner(intent.id))
      return
    case 'income':
      ui.openSheet({ kind: 'income', id: intent.id })
      return
    case 'planned':
      ui.openSheet({ kind: 'confirmPlanned', plannedId: intent.id })
  }
}

/**
 * Opens what `/planning?open=` names once the page's data has loaded, then drops the param so
 * a reload or a back step doesn't reopen it. Re-arms whenever the param changes.
 */
export function useOpenFromPlanningSearch(ready: boolean): void {
  const open = useSearch({ from: '/planning' }).open
  const navigate = useNavigate()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      handled.current = null
      return
    }
    if (!ready || handled.current === open) return
    handled.current = open
    const intent = parsePlanningOpen(open)
    if (intent) openPlanningIntent(intent)
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, open: undefined }),
      replace: true,
    })
  }, [open, ready, navigate])
}
