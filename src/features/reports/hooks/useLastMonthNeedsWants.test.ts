// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { m, tx } from '#/features/planned/testing/fixtures'
import { useLastMonthNeedsWants } from './useLastMonthNeedsWants'

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2, 12))
  await db.categories.bulkPut(defaultCategoryRows())
  await db.transactions.bulkPut([
    tx({
      type: 'income',
      categoryId: catId('salary'),
      amount: m(1_000),
      date: '2026-09-01',
    }),
    tx({ categoryId: catId('groceries'), amount: m(480), date: '2026-09-05' }),
    tx({
      categoryId: catId('cafes', 'dining'),
      amount: m(310),
      date: '2026-09-30',
    }),
    tx({ categoryId: catId('groceries'), amount: m(999), date: '2026-10-01' }),
  ])
})

afterAll(() => {
  vi.useRealTimers()
})

describe('useLastMonthNeedsWants', () => {
  it('reads last calendar month and links to the same report', async () => {
    const { result } = renderHook(() => useLastMonthNeedsWants())
    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary?.line).toBe(
      'Needs 48% · Wants 31% · Savings 21%',
    )
    expect(result.current.reportSearch).toEqual({ range: 'last_month' })
  })
})
