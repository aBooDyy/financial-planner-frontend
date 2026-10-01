import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/apiError'
import type { LocalTransaction, OutboxEntry } from './types'

/**
 * A change the server cannot take is never dropped: it is flagged, kept, and retried —
 * automatically once the server is back or its backoff runs out, at once when the user asks.
 */

const calls: string[] = []
/** What the fake server answers a singular write with, keyed `<op>:<id>`. */
const refusals = new Map<string, ApiError>()
/** Per-item verdicts of the fake bulk create, keyed by id. */
const bulkInvalid = new Map<string, { code: string; field: string }>()

const refused = (status: number, code: string, field?: string) =>
  new ApiError({
    code,
    message: `refused (${status})`,
    status,
    details: field ? [{ field, code }] : [],
  })

const answer = <T>(key: string, value: T): Promise<T> => {
  calls.push(key)
  const error = refusals.get(key)
  return error ? Promise.reject(error) : Promise.resolve(value)
}

const serverTransaction = (id: string) => ({
  id,
  type: 'spend',
  amount: 1,
  currency: 'SAR',
  categoryId: 'cat-groceries',
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-01-01',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  version: `v-${id}`,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi: {
    list: () => {
      calls.push('list')
      return Promise.resolve([])
    },
    create: (payload: { id: string }) =>
      answer(`create:${payload.id}`, serverTransaction(payload.id)),
    update: (id: string) => answer(`update:${id}`, serverTransaction(id)),
    remove: (id: string) => answer(`delete:${id}`, undefined),
    bulkCreate: (items: ReadonlyArray<{ id: string }>) => {
      calls.push(`bulk:${items.length}`)
      return Promise.resolve(
        items.map((item) => {
          const invalid = bulkInvalid.get(item.id)
          return {
            id: item.id,
            status: invalid ? 'invalid' : 'created',
            transaction: invalid ? null : serverTransaction(item.id),
            errorCode: invalid?.code ?? null,
            errorField: invalid?.field ?? null,
          }
        }),
      )
    },
    bulkDelete: () => Promise.resolve([]),
  },
  budgetsApi: { list: () => Promise.resolve([]) },
}))

vi.mock('#/features/wallets/api/walletsApi', () => ({
  walletsApi: {
    createNode: (payload: { id: string }) =>
      answer(`node:${payload.id}`, {
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
      }),
    listNodes: () => Promise.resolve([]),
  },
}))

const TS = '2026-01-01T00:00:00.000Z'

const txCreate = (id: string, walletId = 'w1'): OutboxEntry => ({
  op: 'create',
  entity: 'transaction',
  id,
  payload: { id, type: 'SPEND', amount: 1, wallet_id: walletId },
  baseVersion: null,
  createdAt: TS,
})

const txUpdate = (id: string): OutboxEntry => ({
  op: 'update',
  entity: 'transaction',
  id,
  payload: { type: 'SPEND', amount: 2, version: 'v1' },
  baseVersion: 'v1',
  createdAt: TS,
})

const nodeCreate = (id: string): OutboxEntry => ({
  op: 'create',
  entity: 'node',
  id,
  payload: { id, kind: 'WALLET', name: 'Main' },
  baseVersion: null,
  createdAt: TS,
})

const localRow = (id: string): LocalTransaction => ({
  id,
  type: 'spend',
  amount: 1,
  currency: 'SAR',
  categoryId: 'cat-groceries',
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  plannedId: null,
  date: '2026-01-01',
  note: null,
  source: null,
  transferId: null,
  createdAt: TS,
  updatedAt: TS,
  version: 'v1',
  dirty: 1,
  deleted: 0,
})

const queued = async () => {
  const { db } = await import('./db')
  return db.outbox.orderBy('seq').toArray()
}

beforeAll(async () => {
  await import('./sync')
})

beforeEach(async () => {
  const { db } = await import('./db')
  calls.length = 0
  refusals.clear()
  bulkInvalid.clear()
  await db.outbox.clear()
  await db.transactions.clear()
  await db.balanceNodes.clear()
})

describe('classifying a failed push', () => {
  it.each([
    [503, 'common.unavailable'],
    [429, 'common.rate_limited'],
    [0, 'common.network'],
  ])(
    'a %i keeps the entry, flags it unavailable and stops draining',
    async (status, code) => {
      const { db } = await import('./db')
      const { flushOutbox } = await import('./sync')
      refusals.set('update:tx-1', refused(status, code))
      await db.outbox.bulkAdd([txUpdate('tx-1'), nodeCreate('w9')])

      await flushOutbox()

      const [head, next] = await queued()
      expect(head.failure).toMatchObject({ kind: 'unavailable', status, code })
      expect(head.nextAttemptAt).toBeNull()
      // Never attempted, so plainly pending rather than flagged.
      expect(next.failure).toBeUndefined()
      expect(calls).not.toContain('node:w9')
    },
  )

  it('a 422 keeps the entry, flags it rejected with a backoff, and drains past it', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    refusals.set(
      'update:tx-1',
      refused(422, 'spending.transaction.wallet_invalid', 'wallet_id'),
    )
    await db.outbox.bulkAdd([txUpdate('tx-1'), nodeCreate('w9')])

    await flushOutbox()

    const left = await queued()
    expect(left).toHaveLength(1)
    const [entry] = left
    expect(entry.failure).toMatchObject({
      kind: 'rejected',
      status: 422,
      code: 'spending.transaction.wallet_invalid',
      field: 'wallet_id',
    })
    expect(entry.attempts).toBe(1)
    expect(
      Date.parse(entry.nextAttemptAt ?? '') -
        Date.parse(entry.failure?.at ?? ''),
    ).toBe(60_000)
    expect(calls).toContain('node:w9')
  })

  it('flags a bulk item the server calls INVALID and settles the rest', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    bulkInvalid.set('tx-2', {
      code: 'spending.transaction.category_invalid',
      field: 'category_id',
    })
    await db.outbox.bulkAdd([
      txCreate('tx-1'),
      txCreate('tx-2'),
      txCreate('tx-3'),
    ])

    await flushOutbox()

    const left = await queued()
    expect(left.map((e) => e.id)).toEqual(['tx-2'])
    expect(left[0].failure).toMatchObject({
      kind: 'rejected',
      code: 'spending.transaction.category_invalid',
      field: 'category_id',
    })
    expect(await db.transactions.count()).toBe(2)
  })

  it('still drops an update the server answers 404, with its local row', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    refusals.set('update:tx-1', refused(404, 'spending.transaction.not_found'))
    await db.transactions.put(localRow('tx-1'))
    await db.outbox.add(txUpdate('tx-1'))

    await flushOutbox()

    expect(await queued()).toEqual([])
    expect(await db.transactions.get('tx-1')).toBeUndefined()
  })

  it('still adopts the server copy when a create answers 409', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    refusals.set('create:tx-1', refused(409, 'spending.transaction.id_taken'))
    await db.outbox.add(txCreate('tx-1'))

    await flushOutbox()

    expect(await queued()).toEqual([])
    expect(calls).toContain('list')
  })
})

describe('holding a row behind its failed entry', () => {
  it('never pushes an update ahead of the rejected create it follows', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    refusals.set(
      'create:tx-1',
      refused(422, 'spending.transaction.wallet_invalid', 'wallet_id'),
    )
    await db.outbox.bulkAdd([
      txCreate('tx-1'),
      txUpdate('tx-1'),
      nodeCreate('w9'),
    ])

    await flushOutbox()

    expect(calls).toEqual(['create:tx-1', 'node:w9'])
    const [create, update] = await queued()
    expect(create.failure?.kind).toBe('rejected')
    // Held, not judged: nothing was ever sent for it.
    expect(update.failure).toBeUndefined()
  })
})

describe('backoff', () => {
  it('skips a rejected entry until its next attempt is due, then retries it', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    refusals.set('update:tx-1', refused(422, 'common.validation', 'amount'))
    await db.outbox.add(txUpdate('tx-1'))
    await flushOutbox()
    calls.length = 0

    await flushOutbox()
    expect(calls).toEqual([])

    const [entry] = await queued()
    await db.outbox.update(entry.seq ?? 0, {
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
    })
    await flushOutbox()
    expect(calls).toEqual(['update:tx-1'])
    const [again] = await queued()
    expect(again.attempts).toBe(2)
    // The second rejection waits longer than the first.
    expect(
      Date.parse(again.nextAttemptAt ?? '') -
        Date.parse(again.failure?.at ?? ''),
    ).toBe(5 * 60_000)
  })
})

describe('manual retry', () => {
  it('retrySync ignores the backoff, keeps the count, and pushes at once', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    const { retrySync } = await import('./syncRetry')
    refusals.set('update:tx-1', refused(422, 'common.validation', 'amount'))
    await db.outbox.add(txUpdate('tx-1'))
    await flushOutbox()

    await retrySync('transaction', 'tx-1')
    expect((await queued())[0].attempts).toBe(2)

    refusals.clear()
    await retrySync('transaction', 'tx-1')
    expect(await queued()).toEqual([])
  })

  it('a retried entry that succeeds releases the rows that failed behind it', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    const { retrySync } = await import('./syncRetry')
    refusals.set('node:w1', refused(422, 'balances.node.name_required'))
    refusals.set(
      'create:tx-1',
      refused(422, 'spending.transaction.wallet_invalid', 'wallet_id'),
    )
    await db.outbox.bulkAdd([nodeCreate('w1'), txCreate('tx-1', 'w1')])
    await flushOutbox()
    expect((await queued()).map((e) => e.failure?.kind)).toEqual([
      'rejected',
      'rejected',
    ])

    refusals.clear()
    await retrySync('node', 'w1')

    // The ledger row was still backing off; the wallet reaching the server let it go.
    expect(await queued()).toEqual([])
    expect(calls.slice(-2)).toEqual(['node:w1', 'create:tx-1'])
  })

  it('retryAllFailed retries every flagged entry', async () => {
    const { db } = await import('./db')
    const { flushOutbox } = await import('./sync')
    const { retryAllFailed } = await import('./syncRetry')
    refusals.set('update:tx-1', refused(422, 'common.validation'))
    refusals.set('update:tx-2', refused(422, 'common.validation'))
    await db.outbox.bulkAdd([txUpdate('tx-1'), txUpdate('tx-2')])
    await flushOutbox()

    refusals.clear()
    await retryAllFailed()

    expect(await queued()).toEqual([])
  })
})
