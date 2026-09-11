import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalCategory } from '#/db/types'

export type CategoryView = {
  id: string
  slug: string
  name: string
  type: LocalCategory['type']
  color: string
  position: number
  txCount: number
}

/**
 * Reactive read of the user-editable categories from the local DB, ordered by position, with
 * a live transaction count per category (matching the design's "42 tx" pill).
 */
export function useCategories(): {
  loading: boolean
  categories: CategoryView[]
} {
  const rows = useLiveQuery(() => db.categories.toArray())
  const txns = useLiveQuery(() => db.transactions.toArray())

  const loading = rows === undefined

  const counts = new Map<string, number>()
  for (const t of txns ?? []) {
    if (t.deleted === 0) {
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
    }
  }

  const categories: CategoryView[] = (rows ?? [])
    .filter((c) => c.deleted === 0)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      type: c.type,
      color: c.color,
      position: c.position,
      txCount: counts.get(c.slug) ?? 0,
    }))

  return { loading, categories }
}
