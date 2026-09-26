// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { ConfirmPreview } from '#/features/planned/data/preview'
import { m, planned, tx, wallet } from '#/features/planned/testing/fixtures'
import { useConfirmPlanned } from './useConfirmPlanned'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

afterEach(cleanup)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.balanceNodes.bulkPut([
    wallet({ id: 'w1', name: 'Main Checking', amount: m(20000) }),
    wallet({ id: 'w2', name: 'Savings', amount: m(5000) }),
  ])
  await db.plannedTransactions.put(
    planned({
      id: 'pay',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 's1',
      walletId: 'w1',
      amount: m(12000),
    }),
  )
  await db.transactions.bulkPut([
    tx({ walletId: 'w1', amount: m(35) }),
    tx({ walletId: 'w2', type: 'income', amount: m(700) }),
  ])
})

describe('useConfirmPlanned', () => {
  it("never previews one wallet's balance from another wallet's ledger", async () => {
    const seen: Array<ConfirmPreview['wallet']> = []
    const { rerender } = renderHook(
      ({ walletId }: { walletId: string }) => {
        const c = useConfirmPlanned('pay', walletId)
        seen.push(c.preview(m(12000))?.wallet ?? null)
        return c
      },
      { initialProps: { walletId: 'w1' } },
    )
    await waitFor(() =>
      expect(seen.at(-1)).toEqual({ id: 'w1', balanceAfter: m(31965) }),
    )

    const from = seen.length
    rerender({ walletId: 'w2' })
    await waitFor(() =>
      expect(seen.at(-1)).toEqual({ id: 'w2', balanceAfter: m(17700) }),
    )
    const afterSwitch = seen.slice(from)
    expect(afterSwitch[0]).toBeNull()
    for (const line of afterSwitch)
      if (line) expect(line).toEqual({ id: 'w2', balanceAfter: m(17700) })
  })
})
