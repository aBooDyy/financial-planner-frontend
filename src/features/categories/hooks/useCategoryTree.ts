import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { TxType } from '#/features/transactions/api/types'
import type {
  ResolvedCategory,
  ResolvedSub,
} from '#/features/categories/data/catalog'
import { useCategoryCatalog } from './useCategoryCatalog'

export type CategoryTreeSub = ResolvedSub & { txCount: number }

export type CategoryTreeNode = Omit<ResolvedCategory, 'subs'> & {
  txCount: number
  subs: CategoryTreeSub[]
}

export type CategoryTree = {
  loading: boolean
  type: TxType
  setType: (type: TxType) => void
  categories: CategoryTreeNode[]
}

const pairKey = (slug: string, subSlug: string) => `${slug}\u0000${subSlug}`

/**
 * The Settings list's view model: the catalog of one type, with a live transaction count per
 * row. A parent counts every row filed under it — including rows that also name a child —
 * because that is the number a user deleting the parent needs to see.
 */
export function useCategoryTree(initialType: TxType = 'spend'): CategoryTree {
  const [type, setType] = useState<TxType>(initialType)
  const catalog = useCategoryCatalog()
  const rows = useLiveQuery(() => db.categories.toArray())
  const txns = useLiveQuery(() => db.transactions.toArray())

  const categories = useMemo(() => {
    const parentCounts = new Map<string, number>()
    const pairCounts = new Map<string, number>()
    for (const t of txns ?? []) {
      if (t.deleted === 1 || t.category === null) continue
      parentCounts.set(t.category, (parentCounts.get(t.category) ?? 0) + 1)
      if (t.subcategory) {
        const key = pairKey(t.category, t.subcategory)
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }

    return catalog.byType(type).map((c) => ({
      ...c,
      txCount: parentCounts.get(c.slug) ?? 0,
      subs: c.subs.map((s) => ({
        ...s,
        txCount: pairCounts.get(pairKey(c.slug, s.slug)) ?? 0,
      })),
    }))
  }, [catalog, type, txns])

  return { loading: rows === undefined, type, setType, categories }
}
