import { useEffect, useRef } from 'react'
import { useSearchStore } from '#/features/search/stores/search'
import type { SearchContext } from '#/features/search/data/types'

/**
 * Tells the search sheet which tab and scope are on screen, so it can offer to narrow to
 * them; withdrawn when the page goes away.
 */
export function usePublishSearchContext(context: SearchContext) {
  const setContext = useSearchStore((s) => s.setContext)
  const latest = useRef(context)
  latest.current = context
  // A scope is rebuilt on most renders, so the effect keys on its content.
  const key = JSON.stringify(context)

  useEffect(() => {
    setContext(latest.current)
  }, [key, setContext])

  useEffect(() => () => setContext(null), [setContext])
}
