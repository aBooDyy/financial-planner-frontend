// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { EMPTY_SEARCH_FILTERS } from '#/features/search/data/types'
import type { SearchFilters } from '#/features/search/data/types'
import * as rows from '#/features/planned/testing/fixtures'
import { formatMoney } from '#/lib/currency'
import { useSearchView } from './useSearchView'

type Props = { query: string; filters: SearchFilters; enabled: boolean }

const render = (initial: Props) =>
  renderHook(
    (props: Props) => useSearchView({ ...props, wide: true, context: null }),
    { initialProps: initial },
  )

// The catalog counts as loaded once it holds a category.
beforeEach(async () => {
  await db.categories.put({
    id: 'dining',
    parentId: null,
    slug: 'dining',
    name: 'Dining',
    type: 'spend',
    color: '#D9882B',
    icon: null,
    position: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 'v1',
    dirty: 0,
    deleted: 0,
  })
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await Promise.all([
    db.categories.clear(),
    db.balanceNodes.clear(),
    db.transactions.clear(),
    db.ledgerTotals.clear(),
  ])
})

describe('useSearchView', () => {
  it('shows the idle view on open without reading the ledger', () => {
    const readLedger = vi.spyOn(db.transactions, 'toArray')
    const { result } = render({
      query: '',
      filters: EMPTY_SEARCH_FILTERS,
      enabled: true,
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.view?.idle).toBe(true)
    expect(readLedger).not.toHaveBeenCalled()
  })

  it('reads the ledger once there is a query, loading until it has', async () => {
    const readLedger = vi.spyOn(db.transactions, 'toArray')
    const { result, rerender } = render({
      query: '',
      filters: EMPTY_SEARCH_FILTERS,
      enabled: true,
    })
    rerender({ query: 'din', filters: EMPTY_SEARCH_FILTERS, enabled: true })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.view?.idle).toBe(false))
    expect(result.current.loading).toBe(false)
    expect(readLedger).toHaveBeenCalled()
  })

  it('reads the ledger for a filter set without a query', async () => {
    const readLedger = vi.spyOn(db.transactions, 'toArray')
    render({
      query: '',
      filters: { ...EMPTY_SEARCH_FILTERS, type: 'spend' },
      enabled: true,
    })
    await waitFor(() => expect(readLedger).toHaveBeenCalled())
  })

  it('values accounts from the running totals kept beside the ledger', async () => {
    const vault = rows.wallet({ name: 'Vault', amount: 100_000 })
    await db.balanceNodes.put(vault)
    await db.transactions.put(rows.tx({ walletId: vault.id, amount: 2000 }))
    const { result } = render({
      query: 'vault',
      filters: EMPTY_SEARCH_FILTERS,
      enabled: true,
    })
    await waitFor(() => expect(result.current.view?.idle).toBe(false))
    expect(result.current.view?.groups[0].rows[0].valueStr).toBe(
      formatMoney(98_000, 'SAR'),
    )
  })
})
