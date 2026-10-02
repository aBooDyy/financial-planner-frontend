import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalTransaction, OutboxEntry } from '#/db/types'
import type { Transaction } from '#/features/transactions/api/types'
import { tx } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

const transactionsApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi,
  budgetsApi: {},
}))

const { pushSpendingEntry } = await import('./sync')

const asServer = (row: LocalTransaction, version: string): Transaction => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version } as Transaction
}

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({ ...entry, createdAt: '' })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.transactions.clear(), db.outbox.clear()])
})

describe('pushSpendingEntry', () => {
  it('adopts the server row, clean, when a create’s id is already taken', async () => {
    const local = tx({ id: 't1', dirty: 1, version: '' })
    await db.transactions.put(local)
    transactionsApi.create.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'spending.transaction.id_taken',
        message: '',
      }),
    )
    transactionsApi.list.mockResolvedValue([asServer(local, 'v1')])
    const entry = await queue({
      op: 'create',
      entity: 'transaction',
      id: 't1',
      payload: {},
      baseVersion: null,
    })

    await pushSpendingEntry(entry)

    expect(transactionsApi.update).not.toHaveBeenCalled()
    expect(await db.transactions.get('t1')).toMatchObject({
      version: 'v1',
      dirty: 0,
    })
    expect(await db.outbox.count()).toBe(0)
  })
})
