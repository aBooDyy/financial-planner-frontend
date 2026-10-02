import { useNavigate } from '@tanstack/react-router'
import {
  PLANNING_OPEN_SECTION,
  encodePlanningOpen,
} from '#/features/planning/data/openParam'
import { useSearchStore } from '#/features/search/stores/search'
import type { SearchTarget } from '#/features/search/data/types'
import {
  OPEN_VIEW,
  encodeOpenParam,
} from '#/features/transactions/data/openParam'
import type { OpenIntent } from '#/features/transactions/data/openParam'
import { useEntrySession } from '#/features/transactions/stores/entrySession'

type ItemTarget = Exclude<SearchTarget, { kind: 'account' | 'planned' }>

const openIntentOf = (target: ItemTarget): OpenIntent =>
  target.kind === 'transfer'
    ? { kind: 'transfer', id: target.transferId }
    : { kind: target.kind, id: target.id }

/**
 * Closes the sheet and takes the user to a result: an account becomes the Spending filter,
 * anything else opens in its editor on its own tab.
 */
export function useOpenSearchTarget() {
  const navigate = useNavigate()
  const closeSearch = useSearchStore((s) => s.closeSearch)

  return (target: SearchTarget) => {
    closeSearch()
    if (target.kind === 'account') {
      useEntrySession
        .getState()
        .rememberScope({ type: 'wallet', id: target.id })
      void navigate({
        to: '/transactions/$view',
        params: { view: 'activity' },
      })
      return
    }
    if (target.kind === 'planned') {
      void navigate({
        to: '/planning/$section',
        params: { section: PLANNING_OPEN_SECTION.planned },
        search: { open: encodePlanningOpen(target) },
      })
      return
    }
    const intent = openIntentOf(target)
    void navigate({
      to: '/transactions/$view',
      params: { view: OPEN_VIEW[intent.kind] },
      search: { open: encodeOpenParam(intent) },
    })
  }
}
