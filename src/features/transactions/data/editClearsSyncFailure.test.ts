import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { SyncFailure } from '#/db/types'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { createTransaction, updateTransaction } = await import('./mutations')

const draft = {
  type: 'spend' as const,
  amount: 1_500,
  currency: 'SAR',
  categoryId: 'cat-groceries',
  walletId: 'w-gone',
  goalId: null,
  date: '2026-09-24',
  note: null,
}

const walletGone: SyncFailure = {
  kind: 'rejected',
  status: 422,
  code: 'spending.transaction.wallet_invalid',
  field: 'wallet_id',
  message: 'Wallet not found.',
  at: '2026-09-26T10:00:00.000Z',
}

const flag = async (id: string) => {
  const [entry] = await db.outbox
    .where('[entity+id]')
    .equals(['transaction', id])
    .toArray()
  await db.outbox.put({
    ...entry,
    failure: walletGone,
    attempts: 3,
    nextAttemptAt: '2026-09-26T11:00:00.000Z',
  })
}

beforeEach(async () => {
  await db.transactions.clear()
  await db.outbox.clear()
})

describe('editing a row whose sync failed', () => {
  it('folds the edit into the flagged create and clears its failure, so it retries at once', async () => {
    const id = await createTransaction(draft)
    await flag(id)

    await updateTransaction(id, { ...draft, walletId: 'w-cash' })

    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].payload).toMatchObject({ wallet_id: 'w-cash' })
    expect(entries[0].failure).toBeUndefined()
    expect(entries[0].nextAttemptAt).toBeUndefined()
    // The count survives, so a payload refused again keeps backing off.
    expect(entries[0].attempts).toBe(3)
  })

  it('clears the failure of a flagged update the same way', async () => {
    const id = await createTransaction(draft)
    const [create] = await db.outbox.toArray()
    await db.outbox.delete(create.seq ?? 0)
    await db.transactions.update(id, { version: 'v1', dirty: 0 })
    await updateTransaction(id, { ...draft, amount: 1_600 })
    await flag(id)

    await updateTransaction(id, { ...draft, walletId: 'w-cash' })

    const [entry] = await db.outbox.toArray()
    expect(entry.op).toBe('update')
    expect(entry.failure).toBeUndefined()
    expect(entry.nextAttemptAt).toBeUndefined()
  })
})
