// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { tx } from '#/features/planned/testing/fixtures'
import { useCategoryTree } from './useCategoryTree'
import type { CategoryTreeNode } from './useCategoryTree'

const DINING = catId('dining')
const CAFES = catId('cafes', 'dining')
const TAKEAWAY = catId('takeaway', 'dining')

/** The count the tree used to derive by scanning the whole ledger. */
const scannedCount = (
  rows: ReadonlyArray<LocalTransaction>,
  ids: ReadonlyArray<string>,
): number =>
  rows.filter(
    (r) =>
      r.deleted === 0 && r.categoryId !== null && ids.includes(r.categoryId),
  ).length

const ledger = (): LocalTransaction[] => [
  tx({ categoryId: DINING }),
  tx({ categoryId: CAFES }),
  tx({ categoryId: CAFES }),
  tx({ categoryId: CAFES, deleted: 1 }),
  tx({ categoryId: TAKEAWAY, dirty: 1 }),
  tx({ categoryId: null }),
  tx({ categoryId: catId('groceries') }),
]

const dining = (categories: ReadonlyArray<CategoryTreeNode>) =>
  categories.find((c) => c.id === DINING)!

const cafes = (categories: ReadonlyArray<CategoryTreeNode>) =>
  dining(categories).subs.find((s) => s.id === CAFES)!

beforeEach(async () => {
  await Promise.all([
    db.categories.clear(),
    db.transactions.clear(),
    db.recurrings.clear(),
    db.plannedTransactions.clear(),
  ])
  await db.categories.bulkPut(defaultCategoryRows())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useCategoryTree', () => {
  it('counts ledger rows as a whole-ledger scan would', async () => {
    const rows = ledger()
    await db.transactions.bulkPut(rows)

    const { result } = renderHook(() => useCategoryTree('spend'))
    await waitFor(() =>
      expect(dining(result.current.categories).txCount).toBe(4),
    )

    for (const c of result.current.categories) {
      expect(c.txCount).toBe(
        scannedCount(rows, [c.id, ...c.subs.map((s) => s.id)]),
      )
      for (const s of c.subs) expect(s.txCount).toBe(scannedCount(rows, [s.id]))
    }
    expect(cafes(result.current.categories).txCount).toBe(2)
  })

  it('reads the stored totals, not the ledger', async () => {
    const scan = vi.spyOn(db.transactions, 'toArray')
    await db.ledgerTotals.put({
      id: `category:${CAFES}`,
      kind: 'category',
      ref: CAFES,
      currency: null,
      sum: 0,
      count: 7,
    })

    const { result } = renderHook(() => useCategoryTree('spend'))
    await waitFor(() =>
      expect(cafes(result.current.categories).txCount).toBe(7),
    )

    expect(dining(result.current.categories).txCount).toBe(7)
    expect(scan).not.toHaveBeenCalled()
  })

  it('follows ledger writes', async () => {
    const { result } = renderHook(() => useCategoryTree('spend'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(cafes(result.current.categories).txCount).toBe(0)

    const first = tx({ categoryId: CAFES })
    await act(() => db.transactions.bulkPut([first, tx({ categoryId: CAFES })]))
    await waitFor(() =>
      expect(cafes(result.current.categories).txCount).toBe(2),
    )

    await act(() => db.transactions.put({ ...first, deleted: 1 }))
    await waitFor(() =>
      expect(cafes(result.current.categories).txCount).toBe(1),
    )
  })
})
