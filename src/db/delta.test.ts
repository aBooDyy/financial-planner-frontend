import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalTransaction } from '#/db/types'
import type { Transaction } from '#/features/transactions/api/types'
import { serverTransactionToLocal } from '#/features/transactions/data/mappers'
import { ApiError } from '#/lib/apiError'
import type { ChangesQuery } from './changes'

/**
 * The incremental pull. Everything here turns on one thing: a watermark is a promise that
 * everything before it has been seen, so adopting one the client did not earn loses rows
 * silently — no error, no gap the UI could show, just a ledger permanently missing entries.
 *
 * Driven through the ledger's own delta rather than a synthetic spec, so the apply rules
 * under test are the ones that actually run.
 */

const asTransaction = (id: string): Transaction => ({
  id,
  type: 'spend',
  amount: 100,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-09-01',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  version: `v-${id}`,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
})

type Page = {
  asOf: string
  items: Transaction[]
  deletedIds: string[]
  complete: boolean
  cursor: string | null
  fullResyncRequired: boolean
}

const page = (over: Partial<Page> = {}): Page => ({
  asOf: '2026-09-22T00:00:00Z',
  items: [],
  deletedIds: [],
  complete: true,
  cursor: null,
  fullResyncRequired: false,
  ...over,
})

const networkError = () =>
  new ApiError({ code: 'common.network', message: 'offline', status: 0 })

/** What `/changes` answers, one entry per request; an Error entry is a failed request. */
const answers: Array<Page | Error> = []
const queries: ChangesQuery[] = []
let fullList: Transaction[] = []
let fullPulls = 0

vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi: {
    changes: (query: ChangesQuery) => {
      queries.push(query)
      const next = answers.shift()
      if (next === undefined) throw new Error('unexpected extra /changes call')
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next)
    },
    list: () => {
      fullPulls += 1
      return Promise.resolve(fullList)
    },
  },
  budgetsApi: { list: () => Promise.resolve([]) },
  recurringsApi: { list: () => Promise.resolve([]) },
}))

const { clearLocalDb, db } = await import('./db')
const { useSessionStore } = await import('#/stores/session')
const { pullTransactionsDelta } =
  await import('#/features/transactions/data/sync')

const signIn = (id: string) =>
  useSessionStore.getState().setUser({
    id,
    email: `${id}@example.com`,
    name: id,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 'v1',
  })

const watermarkOf = (userId: string) =>
  db.syncState.get(`${userId}:transaction`).then((row) => row?.since ?? null)

const setWatermark = (since: string) =>
  db.syncState.put({ id: 'user-a:transaction', since, updatedAt: since })

const putLocal = (id: string, over: Partial<LocalTransaction> = {}) =>
  db.transactions.put({
    ...serverTransactionToLocal(asTransaction(id)),
    ...over,
  })

beforeEach(async () => {
  answers.length = 0
  queries.length = 0
  fullList = []
  fullPulls = 0
  await clearLocalDb()
  signIn('user-a')
})

describe('the paging loop', () => {
  it('follows the cursor to the end and only then adopts `as_of`', async () => {
    answers.push(
      page({ items: [asTransaction('t1')], complete: false, cursor: 'c1' }),
      page({ items: [asTransaction('t2')], complete: false, cursor: 'c2' }),
      page({ items: [asTransaction('t3')], asOf: '2026-09-22T10:00:00Z' }),
    )

    await pullTransactionsDelta()

    expect(await db.transactions.count()).toBe(3)
    expect(queries).toEqual([
      { since: null, limit: 1000 },
      { cursor: 'c1', limit: 1000 },
      { cursor: 'c2', limit: 1000 },
    ])
    expect(await watermarkOf('user-a')).toBe('2026-09-22T10:00:00Z')
  })

  it('never sends `since` beside a cursor', async () => {
    await setWatermark('2026-09-01T00:00:00Z')
    answers.push(page({ complete: false, cursor: 'c1' }), page())

    await pullTransactionsDelta()

    expect(queries[0]).toEqual({ since: '2026-09-01T00:00:00Z', limit: 1000 })
    expect(queries[1]).toEqual({ cursor: 'c1', limit: 1000 })
  })

  it('resumes the next run from the watermark it stored', async () => {
    answers.push(page({ asOf: '2026-09-22T10:00:00Z' }))
    await pullTransactionsDelta()

    answers.push(page({ asOf: '2026-09-22T11:00:00Z' }))
    await pullTransactionsDelta()

    expect(queries[1]).toEqual({ since: '2026-09-22T10:00:00Z', limit: 1000 })
  })
})

describe('an interrupted run', () => {
  it('adopts nothing when a later page never arrives', async () => {
    await setWatermark('2026-09-01T00:00:00Z')
    answers.push(
      page({ items: [asTransaction('t1')], complete: false, cursor: 'c1' }),
      networkError(),
    )

    await expect(pullTransactionsDelta()).rejects.toThrow()

    // The page that did arrive is applied; the window stays open at the old watermark.
    expect(await db.transactions.count()).toBe(1)
    expect(await watermarkOf('user-a')).toBe('2026-09-01T00:00:00Z')
  })

  it('restarts from the old watermark and re-applies what it already had', async () => {
    await setWatermark('2026-09-01T00:00:00Z')
    answers.push(
      page({ items: [asTransaction('t1')], complete: false, cursor: 'c1' }),
      networkError(),
    )
    await pullTransactionsDelta().catch(() => undefined)
    queries.length = 0

    answers.push(
      page({
        items: [asTransaction('t1'), asTransaction('t2')],
        asOf: '2026-09-22T12:00:00Z',
      }),
    )
    await pullTransactionsDelta()

    expect(queries[0]).toEqual({ since: '2026-09-01T00:00:00Z', limit: 1000 })
    expect(await db.transactions.count()).toBe(2)
    expect(await watermarkOf('user-a')).toBe('2026-09-22T12:00:00Z')
  })
})

describe('applying a page', () => {
  it('upserts a re-delivered row instead of duplicating it', async () => {
    answers.push(
      page({ items: [asTransaction('t1')], asOf: '2026-09-22T09:00:00Z' }),
    )
    await pullTransactionsDelta()

    // The server reads from a second before the watermark, so the row comes back.
    answers.push(
      page({
        items: [{ ...asTransaction('t1'), note: 'edited elsewhere' }],
        asOf: '2026-09-22T10:00:00Z',
      }),
    )
    await pullTransactionsDelta()

    expect(await db.transactions.count()).toBe(1)
    expect((await db.transactions.get('t1'))?.note).toBe('edited elsewhere')
  })

  it('deletes the ids the server tombstoned', async () => {
    await putLocal('t1')
    await putLocal('t2')
    await setWatermark('2026-09-01T00:00:00Z')
    answers.push(page({ deletedIds: ['t1'] }))

    await pullTransactionsDelta()

    expect(await db.transactions.get('t1')).toBeUndefined()
    expect(await db.transactions.get('t2')).toBeDefined()
  })

  it('keeps an unpushed local edit against both a server update and a tombstone', async () => {
    await putLocal('t1', { note: 'mine', dirty: 1 })
    await putLocal('t2', { note: 'mine too', dirty: 1 })
    await setWatermark('2026-09-01T00:00:00Z')
    answers.push(
      page({
        items: [{ ...asTransaction('t1'), note: 'theirs' }],
        deletedIds: ['t2'],
      }),
    )

    await pullTransactionsDelta()

    // Whole-record last-write-wins: the queued write decides, and the 404 its push earns
    // is what finally drops a row the server has deleted.
    expect((await db.transactions.get('t1'))?.note).toBe('mine')
    expect(await db.transactions.get('t2')).toBeDefined()
  })

  it('drops local rows a first sync did not deliver', async () => {
    // A database upgraded from before delta sync: full of rows, with no watermark.
    await putLocal('gone')
    await putLocal('mine', { dirty: 1 })
    answers.push(page({ items: [asTransaction('t1')] }))

    await pullTransactionsDelta()

    expect(await db.transactions.get('gone')).toBeUndefined()
    expect(await db.transactions.get('mine')).toBeDefined()
    expect(await db.transactions.get('t1')).toBeDefined()
  })
})

describe('full_resync_required', () => {
  it('runs the full pull first, then adopts the fresh `as_of`', async () => {
    await putLocal('stale')
    await setWatermark('2020-01-01T00:00:00Z')
    fullList = [asTransaction('t1')]
    answers.push(
      page({ fullResyncRequired: true, asOf: '2026-09-22T13:00:00Z' }),
    )

    await pullTransactionsDelta()

    expect(fullPulls).toBe(1)
    // The full pull's own reconciliation removes a row the server no longer has — exactly
    // what the delta could not be trusted for across the tombstone retention window.
    expect(await db.transactions.get('stale')).toBeUndefined()
    expect(await db.transactions.get('t1')).toBeDefined()
    expect(await watermarkOf('user-a')).toBe('2026-09-22T13:00:00Z')
  })
})

describe('a watermark that outlives its owner', () => {
  it('dies with the local data on sign-out', async () => {
    answers.push(page({ asOf: '2026-09-22T10:00:00Z' }))
    await pullTransactionsDelta()
    expect(await watermarkOf('user-a')).toBe('2026-09-22T10:00:00Z')

    await clearLocalDb()

    expect(await db.syncState.count()).toBe(0)
  })

  it('is never read by a different user on the same device', async () => {
    answers.push(page({ asOf: '2026-09-22T10:00:00Z' }))
    await pullTransactionsDelta()

    // A sign-out whose best-effort wipe failed: the row survives, but it is not user-b's.
    signIn('user-b')
    answers.push(page({ asOf: '2026-09-22T11:00:00Z' }))
    await pullTransactionsDelta()

    expect(queries[1]).toEqual({ since: null, limit: 1000 })
    expect(await watermarkOf('user-a')).toBe('2026-09-22T10:00:00Z')
    expect(await watermarkOf('user-b')).toBe('2026-09-22T11:00:00Z')
  })
})

describe('a watermark the server refuses', () => {
  it('is discarded and the run restarted, rather than wedging the entity forever', async () => {
    await setWatermark('not-a-timestamp')
    answers.push(
      new ApiError({
        code: 'sync.since_invalid',
        message: 'bad since',
        status: 422,
      }),
      page({ asOf: '2026-09-22T14:00:00Z' }),
    )

    await pullTransactionsDelta()

    expect(queries[1]).toEqual({ since: null, limit: 1000 })
    expect(await watermarkOf('user-a')).toBe('2026-09-22T14:00:00Z')
  })
})
