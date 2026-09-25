import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { TxType } from '#/features/transactions/api/types'
import type {
  ResolvedCategory,
  ResolvedSub,
} from '#/features/categories/data/catalog'
import { useCategoryCatalog } from './useCategoryCatalog'

/** How many ledger entries and recurring schedules are filed under a row. */
type FiledCounts = { txCount: number; recurringCount: number }

export type CategoryTreeSub = ResolvedSub & FiledCounts

export type CategoryTreeNode = Omit<ResolvedCategory, 'subs'> &
  FiledCounts & {
    subs: CategoryTreeSub[]
  }

export type CategoryTree = {
  loading: boolean
  type: TxType
  setType: (type: TxType) => void
  categories: CategoryTreeNode[]
}

const pairKey = (slug: string, subSlug: string) => `${slug}\u0000${subSlug}`

type Filed = {
  category: string | null
  subcategory: string | null
  deleted: number
}

type Tally = { byParent: Map<string, number>; byPair: Map<string, number> }

const bump = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1)

function tally(rows: ReadonlyArray<Filed>): Tally {
  const byParent = new Map<string, number>()
  const byPair = new Map<string, number>()
  for (const r of rows) {
    if (r.deleted === 1 || r.category === null) continue
    bump(byParent, r.category)
    if (r.subcategory) bump(byPair, pairKey(r.category, r.subcategory))
  }
  return { byParent, byPair }
}

/**
 * The Settings list's view model: the catalog of one type, with live transaction and
 * recurring counts per row. A parent counts every row filed under it — including rows that also name a child —
 * because that is the number a user deleting the parent needs to see.
 */
export function useCategoryTree(initialType: TxType = 'spend'): CategoryTree {
  const [type, setType] = useState<TxType>(initialType)
  const catalog = useCategoryCatalog()
  const rows = useLiveQuery(() => db.categories.toArray())
  const txns = useLiveQuery(() => db.transactions.toArray())
  const recurrings = useLiveQuery(() => db.recurrings.toArray())

  const categories = useMemo(() => {
    const tx = tally(txns ?? [])
    const rec = tally(recurrings ?? [])
    return catalog.byType(type).map((c) => ({
      ...c,
      txCount: tx.byParent.get(c.slug) ?? 0,
      recurringCount: rec.byParent.get(c.slug) ?? 0,
      subs: c.subs.map((s) => {
        const key = pairKey(c.slug, s.slug)
        return {
          ...s,
          txCount: tx.byPair.get(key) ?? 0,
          recurringCount: rec.byPair.get(key) ?? 0,
        }
      }),
    }))
  }, [catalog, type, txns, recurrings])

  return { loading: rows === undefined, type, setType, categories }
}
