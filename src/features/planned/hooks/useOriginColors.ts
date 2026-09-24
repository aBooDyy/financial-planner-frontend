import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalPlanned } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'

const FALLBACK = 'var(--fp-text-3)'

/**
 * The colour a planned row's icon borrows from what it came from: its goal, its income
 * stream, or (a Spending schedule) its category.
 */
export function useOriginColors(): (item: LocalPlanned) => string {
  const goals = useLiveQuery(() => db.goals.toArray())
  const streams = useLiveQuery(() => db.incomeStreams.toArray())
  const catalog = useCategoryCatalog()
  const byId = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of goals ?? []) if (g.color) m.set(g.id, g.color)
    for (const s of streams ?? []) if (s.color) m.set(s.id, s.color)
    return m
  }, [goals, streams])

  return useCallback(
    (item: LocalPlanned) =>
      (item.goalId ? byId.get(item.goalId) : undefined) ??
      (item.incomeStreamId ? byId.get(item.incomeStreamId) : undefined) ??
      (item.category ? catalog.get(item.category).color : undefined) ??
      FALLBACK,
    [byId, catalog],
  )
}
