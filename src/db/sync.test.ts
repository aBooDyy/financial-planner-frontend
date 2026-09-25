import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/apiError'
import type { OutboxEntry } from './types'

/**
 * The outbox drain. A CSV import queues one `create` per row, so the shape of this loop is
 * the difference between a three-second commit and minutes of syncing — and between a
 * correct ledger and one where a transaction reached the server before its account did.
 */

const order: string[] = []
const batches: string[][] = []
const deleteBatches: string[][] = []
const inFlight = { now: 0, peak: 0 }

/** What the fake bulk endpoint answers for one id, keyed before the call. */
const answers = new Map<string, 'created' | 'taken' | 'invalid'>()
/** What the fake bulk-delete endpoint answers for one id, keyed before the call. */
const deleteAnswers = new Map<string, 'deleted' | 'missing' | 'invalid'>()
let bulkFailure: Error | null = null
let bulkDeleteFailure: Error | null = null
/** Answer only the first id, to stand in for a response that settles part of a batch. */
let halfAnswered = false

const serverTransaction = (id: string) => ({
  id,
  type: 'spend',
  amount: 1,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-01-01',
  note: null,
  source: null,
  version: `v-${id}`,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi: {
    list: () => Promise.resolve([]),
    create: (payload: { id: string }) => {
      order.push(`tx:${payload.id}`)
      return Promise.resolve(serverTransaction(payload.id))
    },
    bulkCreate: async (items: ReadonlyArray<{ id: string }>) => {
      if (bulkFailure) throw bulkFailure
      batches.push(items.map((item) => item.id))
      order.push(`bulk:${items.length}`)
      inFlight.now += 1
      inFlight.peak = Math.max(inFlight.peak, inFlight.now)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight.now -= 1
      return await Promise.resolve(
        items.map((item) => {
          const status = answers.get(item.id) ?? 'created'
          return {
            id: item.id,
            status,
            transaction:
              status === 'invalid' ? null : serverTransaction(item.id),
            errorCode:
              status === 'invalid'
                ? 'spending.transaction.wallet_invalid'
                : null,
          }
        }),
      )
    },
    remove: (id: string) => {
      order.push(`del:${id}`)
      return Promise.resolve(undefined)
    },
    bulkDelete: async (ids: ReadonlyArray<string>) => {
      if (bulkDeleteFailure) throw bulkDeleteFailure
      deleteBatches.push([...ids])
      order.push(`bulkDel:${ids.length}`)
      inFlight.now += 1
      inFlight.peak = Math.max(inFlight.peak, inFlight.now)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight.now -= 1
      const answeredIds = halfAnswered ? ids.slice(0, 1) : ids
      return await Promise.resolve(
        answeredIds.map((id) => ({
          id,
          status: deleteAnswers.get(id) ?? 'deleted',
          errorCode: null,
        })),
      )
    },
  },
  budgetsApi: { list: () => Promise.resolve([]) },
  recurringsApi: { list: () => Promise.resolve([]) },
}))

vi.mock('#/features/balances/api/balancesApi', () => ({
  balancesApi: {
    createNode: (payload: { id: string }) => {
      order.push(`node:${payload.id}`)
      return Promise.resolve({
        id: payload.id,
        kind: 'wallet',
        name: 'Main',
        color: '#000',
        note: null,
        parentId: null,
        amount: 0,
        currency: 'SAR',
        version: 'v1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })
    },
    listNodes: () => Promise.resolve([]),
  },
}))

const TS = '2026-01-01T00:00:00.000Z'

const txEntry = (i: number): OutboxEntry => ({
  op: 'create',
  entity: 'transaction',
  id: `tx-${i}`,
  payload: {
    id: `tx-${i}`,
    type: 'SPEND',
    amount: 1,
    currency: 'SAR',
    category: 'groceries',
    subcategory: null,
    wallet_id: 'w1',
    goal_id: null,
    merchant_id: null,
    date: '2026-01-01',
    note: null,
    source: 'csv:b1',
  },
  baseVersion: null,
  createdAt: TS,
})

const txDeleteEntry = (i: number): OutboxEntry => ({
  op: 'delete',
  entity: 'transaction',
  id: `tx-${i}`,
  payload: null,
  baseVersion: null,
  createdAt: TS,
})

const nodeEntry = (id: string): OutboxEntry => ({
  op: 'create',
  entity: 'node',
  id,
  payload: { id, kind: 'WALLET', name: 'Main' },
  baseVersion: null,
  createdAt: TS,
})

const offline = () =>
  new ApiError({ code: 'network', message: 'offline', status: 0 })

/** Re-publish the server's caps; `applyConfig` ignores a stamp it already holds. */
const withBulkMax = async (transactionBulkMax: number) => {
  const { useAppConfigStore, getAppConfig } =
    await import('#/lib/config/appConfig')
  const current = getAppConfig()
  useAppConfigStore.getState().applyConfig({
    ...current,
    version: `test-${transactionBulkMax}`,
    limits: { ...current.limits, transactionBulkMax },
  })
}

// Load the engine once, up front: every test below imports it, and leaving that cost to
// whichever test ran first made that test, and only that test, time out under load.
beforeAll(async () => {
  await import('./sync')
})

beforeEach(async () => {
  order.length = 0
  batches.length = 0
  deleteBatches.length = 0
  inFlight.now = 0
  inFlight.peak = 0
  answers.clear()
  deleteAnswers.clear()
  bulkFailure = null
  bulkDeleteFailure = null
  halfAnswered = false
  await withBulkMax(1000)
})

describe('bulkRunLength', () => {
  it('groups every adjacent transaction create — the batching is downstream', async () => {
    const { bulkRunLength } = await import('./sync')
    const page = Array.from({ length: 10 }, (_unused, i) => txEntry(i))
    expect(bulkRunLength(page, 0)).toBe(10)
    expect(bulkRunLength(page, 7)).toBe(3)
  })

  it('never groups a node create — a child could outrun its parent', async () => {
    const { bulkRunLength } = await import('./sync')
    const page = [nodeEntry('w1'), nodeEntry('w2'), nodeEntry('w3')]
    expect(bulkRunLength(page, 0)).toBe(1)
  })

  it('stops a run at the first op that is not a transaction create', async () => {
    const { bulkRunLength } = await import('./sync')
    const page = [
      txEntry(0),
      txEntry(1),
      { ...txEntry(2), op: 'update' as const },
      txEntry(3),
    ]
    expect(bulkRunLength(page, 0)).toBe(2)
  })

  it('groups adjacent transaction deletes the same way', async () => {
    const { bulkRunLength } = await import('./sync')
    const page = Array.from({ length: 6 }, (_u, i) => txDeleteEntry(i))
    expect(bulkRunLength(page, 0)).toBe(6)
  })

  it('never mixes ops in one run — a create must precede the delete of its row', async () => {
    const { bulkRunLength } = await import('./sync')
    const page = [txEntry(0), txEntry(1), txDeleteEntry(0), txDeleteEntry(1)]
    expect(bulkRunLength(page, 0)).toBe(2)
    expect(bulkRunLength(page, 2)).toBe(2)
  })

  it('groups planned creates on their own, never with ledger rows or planned updates', async () => {
    const { bulkRunLength } = await import('./sync')
    const planned = (
      i: number,
      op: OutboxEntry['op'] = 'create',
    ): OutboxEntry => ({
      op,
      entity: 'planned',
      id: `p-${i}`,
      payload: { id: `p-${i}` },
      baseVersion: null,
      createdAt: TS,
    })
    const page = [
      planned(0),
      planned(1),
      planned(2),
      txEntry(0),
      planned(3),
      planned(3, 'update'),
      planned(4, 'update'),
    ]
    expect(bulkRunLength(page, 0)).toBe(3)
    expect(bulkRunLength(page, 3)).toBe(1)
    expect(bulkRunLength(page, 4)).toBe(1)
    expect(bulkRunLength(page, 5)).toBe(1)
  })
})

describe('bulkRunLength — transfers', () => {
  it('groups transfer creates and transfer deletes on their own, never with ledger rows', async () => {
    const { bulkRunLength } = await import('./sync')
    const transfer = (i: number, op: OutboxEntry['op']): OutboxEntry => ({
      op,
      entity: 'transfer',
      id: `t-${i}`,
      payload: op === 'delete' ? null : { id: `t-${i}` },
      baseVersion: null,
      createdAt: TS,
    })
    const page = [
      transfer(0, 'create'),
      transfer(1, 'create'),
      txEntry(0),
      transfer(2, 'delete'),
      transfer(3, 'delete'),
      transfer(4, 'update'),
      transfer(5, 'update'),
    ]
    expect(bulkRunLength(page, 0)).toBe(2)
    expect(bulkRunLength(page, 2)).toBe(1)
    expect(bulkRunLength(page, 3)).toBe(2)
    expect(bulkRunLength(page, 5)).toBe(1)
  })
})

describe('flushOutbox', () => {
  it('sends a run of transaction creates as one request', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    await db.outbox.bulkAdd(Array.from({ length: 12 }, (_u, i) => txEntry(i)))

    await flushOutbox()

    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(12)
    expect(await db.outbox.count()).toBe(0)
    // Each row is stored as the server returned it, so nothing is left dirty.
    const stored = await db.transactions.toArray()
    expect(stored).toHaveLength(12)
    expect(stored.every((row) => row.dirty === 0)).toBe(true)
  })

  it('cuts a long stretch into capped batches and overlaps them', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await withBulkMax(4)
    await db.outbox.clear()
    await db.transactions.clear()
    await db.outbox.bulkAdd(Array.from({ length: 10 }, (_u, i) => txEntry(i)))

    await flushOutbox()

    expect(batches.map((batch) => batch.length)).toEqual([4, 4, 2])
    // Independent batches do not wait on each other's insert.
    expect(inFlight.peak).toBeGreaterThan(1)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.transactions.count()).toBe(10)
  })

  it('settles an id the server already holds and drops one it refuses', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    answers.set('tx-1', 'taken')
    answers.set('tx-2', 'invalid')
    await db.outbox.bulkAdd([txEntry(0), txEntry(1), txEntry(2)])

    await flushOutbox()

    expect(await db.outbox.count()).toBe(0)
    // The taken id comes back with the row behind it, so the local copy stops being dirty.
    expect((await db.transactions.get('tx-1'))?.version).toBe('v-tx-1')
    // The refused one can never succeed as posted; it leaves the queue unwritten.
    expect(await db.transactions.get('tx-2')).toBeUndefined()
  })

  it('keeps the batch queued when the network is gone', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    bulkFailure = offline()
    await db.outbox.bulkAdd([txEntry(0), txEntry(1)])

    await flushOutbox()

    expect(await db.outbox.count()).toBe(2)
  })

  it('falls back to one request per row when the batch fails as a whole', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    bulkFailure = new ApiError({
      code: 'internal',
      message: 'the batch judged no entry',
      status: 500,
    })
    await db.outbox.bulkAdd([txEntry(0), txEntry(1)])

    await flushOutbox()

    expect(order).toEqual(['tx:tx-0', 'tx:tx-1'])
    expect(await db.outbox.count()).toBe(0)
    expect(await db.transactions.count()).toBe(2)
  })

  it('sends a run of transaction deletes as one request', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    await db.outbox.bulkAdd(
      Array.from({ length: 12 }, (_u, i) => txDeleteEntry(i)),
    )

    await flushOutbox()

    expect(deleteBatches).toHaveLength(1)
    expect(deleteBatches[0]).toHaveLength(12)
    expect(await db.outbox.count()).toBe(0)
  })

  it('cuts a long stretch of deletes into capped batches and overlaps them', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await withBulkMax(4)
    await db.outbox.clear()
    await db.transactions.clear()
    await db.outbox.bulkAdd(
      Array.from({ length: 10 }, (_u, i) => txDeleteEntry(i)),
    )

    await flushOutbox()

    expect(deleteBatches.map((batch) => batch.length)).toEqual([4, 4, 2])
    // Independent batches do not wait on each other's delete.
    expect(inFlight.peak).toBeGreaterThan(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('drops an id the server no longer holds, and the unusable one too', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    deleteAnswers.set('tx-1', 'missing')
    deleteAnswers.set('tx-2', 'invalid')
    await db.outbox.bulkAdd([
      txDeleteEntry(0),
      txDeleteEntry(1),
      txDeleteEntry(2),
    ])

    await flushOutbox()

    // Every answer is terminal: there is nothing left to retry for any of the three.
    expect(await db.outbox.count()).toBe(0)
    expect(await db.transactions.count()).toBe(0)
  })

  it('keeps a delete batch queued when the network is gone', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    bulkDeleteFailure = offline()
    await db.outbox.bulkAdd([txDeleteEntry(0), txDeleteEntry(1)])

    await flushOutbox()

    expect(await db.outbox.count()).toBe(2)

    // An import undone offline still drains as a batch once the network returns.
    bulkDeleteFailure = null
    await flushOutbox()
    expect(deleteBatches).toEqual([['tx-0', 'tx-1']])
    expect(await db.outbox.count()).toBe(0)
  })

  it('leaves an unanswered delete queued for the next drain', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    const { pushTransactionDeletes } =
      await import('#/features/transactions/data/sync')
    await db.outbox.clear()
    await db.transactions.clear()
    await db.outbox.bulkAdd([txDeleteEntry(0), txDeleteEntry(1)])
    const queued = await db.outbox.orderBy('seq').toArray()

    // A half-answered response settles what it names and nothing else.
    halfAnswered = true
    await pushTransactionDeletes(queued)
    halfAnswered = false

    expect(await db.outbox.count()).toBe(1)
    await flushOutbox()
    expect(await db.outbox.count()).toBe(0)
  })

  it('falls back to one request per row when the delete batch fails as a whole', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    bulkDeleteFailure = new ApiError({
      code: 'internal',
      message: 'the batch judged no entry',
      status: 500,
    })
    await db.outbox.bulkAdd([txDeleteEntry(0), txDeleteEntry(1)])

    await flushOutbox()

    expect(order).toEqual(['del:tx-0', 'del:tx-1'])
    expect(await db.outbox.count()).toBe(0)
  })

  it('drains a 2 608-row undo in three requests, not 2 608', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    // The measured import: 2 608 rows committed, then "Undo this import".
    await db.outbox.bulkAdd(
      Array.from({ length: 2608 }, (_u, i) => txDeleteEntry(i)),
    )

    await flushOutbox()

    expect(deleteBatches.map((batch) => batch.length)).toEqual([
      1000, 1000, 608,
    ])
    expect(await db.outbox.count()).toBe(0)
  }, 20_000)

  it('keeps a wallet create strictly before the rows that point at it', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    await db.outbox.clear()
    await db.transactions.clear()
    await db.balanceNodes.clear()
    await db.outbox.bulkAdd([
      nodeEntry('w1'),
      ...Array.from({ length: 4 }, (_u, i) => txEntry(100 + i)),
    ])

    await flushOutbox()

    expect(order).toEqual(['node:w1', 'bulk:4'])
    expect(await db.outbox.count()).toBe(0)
  })
})
