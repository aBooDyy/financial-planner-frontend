// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalMerchant, LocalTransaction } from '#/db/types'
import { tx } from '#/features/planned/testing/fixtures'
import { useMerchants } from './useMerchants'
import type { MerchantView } from './useMerchants'

const merchant = (id: string, timesSeen = 1): LocalMerchant => ({
  id,
  displayName: id,
  learnedCategoryId: null,
  learnedType: null,
  timesSeen,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  version: 'v',
  dirty: 0,
  deleted: 0,
})

/** The count the list used to derive by scanning the whole ledger. */
const scannedCount = (rows: ReadonlyArray<LocalTransaction>, id: string) =>
  rows.filter((r) => r.deleted === 0 && r.merchantId === id).length

const countOf = (merchants: ReadonlyArray<MerchantView>, id: string) =>
  merchants.find((m) => m.id === id)?.txCount

beforeEach(async () => {
  await Promise.all([
    db.merchants.clear(),
    db.merchantAliases.clear(),
    db.transactions.clear(),
  ])
  await db.merchants.bulkPut([
    merchant('m-a'),
    merchant('m-b'),
    merchant('m-c'),
  ])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useMerchants', () => {
  it('counts ledger rows as a whole-ledger scan would', async () => {
    const rows = [
      tx({ merchantId: 'm-a' }),
      tx({ merchantId: 'm-a' }),
      tx({ merchantId: 'm-a', deleted: 1 }),
      tx({ merchantId: 'm-b', deleted: 1 }),
      tx({ merchantId: null }),
    ]
    await db.transactions.bulkPut(rows)

    const { result } = renderHook(() => useMerchants())
    await waitFor(() =>
      expect(countOf(result.current.merchants, 'm-a')).toBe(2),
    )

    for (const m of result.current.merchants)
      expect(m.txCount).toBe(scannedCount(rows, m.id))
  })

  it('reads the stored totals, not the ledger', async () => {
    const scan = vi.spyOn(db.transactions, 'toArray')
    await db.ledgerTotals.put({
      id: 'merchant:m-c',
      kind: 'merchant',
      ref: 'm-c',
      currency: null,
      sum: 0,
      count: 5,
    })

    const { result } = renderHook(() => useMerchants())
    await waitFor(() =>
      expect(countOf(result.current.merchants, 'm-c')).toBe(5),
    )

    expect(result.current.merchants[0].id).toBe('m-c')
    expect(scan).not.toHaveBeenCalled()
  })

  it('follows ledger writes', async () => {
    const { result } = renderHook(() => useMerchants())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(countOf(result.current.merchants, 'm-b')).toBe(0)

    const row = tx({ merchantId: 'm-b' })
    await act(() => db.transactions.put(row))
    await waitFor(() =>
      expect(countOf(result.current.merchants, 'm-b')).toBe(1),
    )

    await act(() => db.transactions.delete(row.id))
    await waitFor(() =>
      expect(countOf(result.current.merchants, 'm-b')).toBe(0),
    )
  })
})
