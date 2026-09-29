// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import * as rows from '#/features/planned/testing/fixtures'
import { formatMoney } from '#/lib/currency'
import { useArchivedNodes } from './useArchivedNodes'

afterEach(async () => {
  cleanup()
  await Promise.all([
    db.balanceNodes.clear(),
    db.transactions.clear(),
    db.ledgerTotals.clear(),
  ])
})

describe('useArchivedNodes', () => {
  it('values an archived wallet from the running totals kept beside the ledger', async () => {
    const vault = rows.wallet({ amount: 100_000, archivedAt: '2026-09-01' })
    await db.balanceNodes.bulkPut([vault, rows.wallet()])
    await db.transactions.put(rows.tx({ walletId: vault.id, amount: 2000 }))

    const { result } = renderHook(() => useArchivedNodes())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({
      id: vault.id,
      balanceStr: formatMoney(98_000, 'SAR'),
    })
  })
})
