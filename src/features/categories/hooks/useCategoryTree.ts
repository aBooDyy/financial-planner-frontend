import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { TxType } from '#/features/transactions/api/types'
import type {
  ResolvedCategory,
  ResolvedSub,
} from '#/features/categories/data/catalog'
import { useCategoryCatalog } from './useCategoryCatalog'

/** How many ledger entries, recurring schedules and planned items are filed under a row. */
type FiledCounts = {
  txCount: number
  recurringCount: number
  plannedCount: number
}

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

type Filed = { categoryId: string | null; deleted: number }

/** Live rows per category id — the leaf each row names. */
function tally(rows: ReadonlyArray<Filed> | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows ?? []) {
    if (r.deleted === 1 || r.categoryId === null) continue
    counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1)
  }
  return counts
}

const sumOf = (counts: Map<string, number>, ids: ReadonlyArray<string>) =>
  ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0)

/**
 * The Settings list's view model: the catalog of one type, with live counts per row. A parent
 * counts every row filed under it or any of its children — the number a user deleting the
 * parent needs to see, since its delete takes the children too.
 */
export function useCategoryTree(initialType: TxType = 'spend'): CategoryTree {
  const [type, setType] = useState<TxType>(initialType)
  const catalog = useCategoryCatalog()
  const rows = useLiveQuery(() => db.categories.toArray())
  const txns = useLiveQuery(() => db.transactions.toArray())
  const recurrings = useLiveQuery(() => db.recurrings.toArray())
  const planned = useLiveQuery(() => db.plannedTransactions.toArray())

  const categories = useMemo(() => {
    const tx = tally(txns)
    const rec = tally(recurrings)
    const plan = tally(planned)
    const countsOf = (ids: ReadonlyArray<string>): FiledCounts => ({
      txCount: sumOf(tx, ids),
      recurringCount: sumOf(rec, ids),
      plannedCount: sumOf(plan, ids),
    })
    return catalog.byType(type).map((c) => ({
      ...c,
      ...countsOf([c.id, ...c.subs.map((s) => s.id)]),
      subs: c.subs.map((s) => ({ ...s, ...countsOf([s.id]) })),
    }))
  }, [catalog, type, txns, recurrings, planned])

  return { loading: rows === undefined, type, setType, categories }
}
