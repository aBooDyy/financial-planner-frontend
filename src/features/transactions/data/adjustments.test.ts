import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { bulkAddTransactions, createAdjustment, updateAdjustment } =
  await import('./mutations')

const draft = {
  type: 'adjustment_out' as const,
  amount: 12_000,
  currency: 'SAR',
  walletId: 'w1',
  date: '2026-09-24',
  note: 'Matched statement',
}

beforeEach(async () => {
  await db.transactions.clear()
  await db.outbox.clear()
})

describe('balance adjustment mutations', () => {
  it('writes one unlinked row and queues its create', async () => {
    const id = await createAdjustment(draft)

    expect(await db.transactions.get(id)).toMatchObject({
      type: 'adjustment_out',
      amount: 12_000,
      category: null,
      subcategory: null,
      goalId: null,
      merchantId: null,
      plannedId: null,
      transferId: null,
      dirty: 1,
    })
    const [entry] = await db.outbox.toArray()
    expect(entry).toMatchObject({ op: 'create', entity: 'transaction', id })
    expect(entry.payload).toMatchObject({
      type: 'ADJUSTMENT_OUT',
      category: null,
    })
  })

  it('folds an edit into the queued create', async () => {
    const id = await createAdjustment(draft)

    await updateAdjustment(id, {
      ...draft,
      type: 'adjustment_in',
      amount: 500,
    })

    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].payload).toMatchObject({
      type: 'ADJUSTMENT_IN',
      amount: 500,
    })
  })

  it('leaves a cash-flow row alone', async () => {
    await bulkAddTransactions([
      {
        id: 'spend-1',
        draft: {
          type: 'spend',
          amount: 1_000,
          currency: 'SAR',
          category: 'groceries',
          subcategory: null,
          walletId: 'w1',
          goalId: null,
          date: '2026-09-24',
          note: null,
        },
      },
    ])

    await updateAdjustment('spend-1', draft)

    expect(await db.transactions.get('spend-1')).toMatchObject({
      type: 'spend',
      category: 'groceries',
    })
  })

  it('bulk-writes adjustments beside cash flow', async () => {
    await bulkAddTransactions([{ id: 'adj-1', draft }])

    expect(await db.transactions.get('adj-1')).toMatchObject({
      type: 'adjustment_out',
      category: null,
    })
  })
})
