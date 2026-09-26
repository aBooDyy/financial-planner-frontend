// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import type { RangeMode } from '#/features/transactions/constants'
import { useLedgerWindow } from './useLedgerWindow'
import { catId } from '#/features/categories/__fixtures__/categories'

const row = (id: string, date: string): LocalTransaction => ({
  id,
  type: 'spend',
  amount: 100,
  currency: 'SAR',
  categoryId: catId('groceries'),
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date,
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
})

type Period = { anchor: string; mode: RangeMode }

beforeAll(async () => {
  await db.transactions.bulkPut([
    row('june', '2025-06-10'),
    row('july', '2025-07-10'),
  ])
})

describe('useLedgerWindow', () => {
  it('keeps the last period on hand while the next one loads, then swaps', async () => {
    const { result, rerender } = renderHook(
      (p: Period) => useLedgerWindow(p.anchor, p.mode, '2026-09-26'),
      { initialProps: { anchor: '2025-06-01', mode: 'month' } },
    )
    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rows.map((t) => t.id)).toEqual(['june'])

    rerender({ anchor: '2025-07-01', mode: 'month' })
    // Never back to "nothing loaded": the June answer stands, still labelled June.
    expect(result.current?.anchor).toBe('2025-06-01')

    await waitFor(() => expect(result.current?.anchor).toBe('2025-07-01'))
    expect(result.current?.rows.map((t) => t.id)).toEqual(['july'])
  })
})
