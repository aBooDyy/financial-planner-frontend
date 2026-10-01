import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalBill, OutboxEntry } from '#/db/types'
import type { Bill, UpdateBillWire } from '#/features/bills/api/types'
import { bill } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
}))
vi.mock('#/features/bills/api/billsApi', () => ({ billsApi: api }))

const { pullBills, pushBillsEntry } = await import('./sync')

const asServer = (row: LocalBill, version: string): Bill => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}

const failure = (status: number, code: string) =>
  new ApiError({ status, code, message: code })

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({ ...entry, createdAt: '' })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.bills.clear(), db.outbox.clear()])
})

describe('pushBillsEntry', () => {
  it('stores the server’s copy of a created bill and settles the entry', async () => {
    const local = bill({ id: 'b1', dirty: 1, version: '' })
    await db.bills.put(local)
    api.create.mockResolvedValue(asServer(local, 'v1'))
    const entry = await queue({
      op: 'create',
      entity: 'bill',
      id: 'b1',
      payload: {},
      baseVersion: null,
    })

    await pushBillsEntry(entry)

    expect(await db.bills.get('b1')).toMatchObject({ version: 'v1', dirty: 0 })
    expect(await db.outbox.count()).toBe(0)
  })

  it('rebases a stale update on the server’s version and retries once', async () => {
    const local = bill({ id: 'b1', amount: 50, dirty: 1, version: 'v1' })
    await db.bills.put(local)
    api.update
      .mockRejectedValueOnce(failure(409, 'common.conflict'))
      .mockImplementationOnce((_id: string, body: UpdateBillWire) =>
        Promise.resolve({ ...asServer(local, 'v3'), amount: body.amount }),
      )
    api.list.mockResolvedValue([asServer({ ...local, amount: 10 }, 'v2')])
    const entry = await queue({
      op: 'update',
      entity: 'bill',
      id: 'b1',
      payload: { version: 'v1' },
      baseVersion: 'v1',
    })

    await pushBillsEntry(entry)

    expect(api.update).toHaveBeenLastCalledWith(
      'b1',
      expect.objectContaining({ version: 'v2', amount: 50 }),
    )
    expect(await db.bills.get('b1')).toMatchObject({
      amount: 50,
      version: 'v3',
      dirty: 0,
    })
  })

  it('drops the local row when the server no longer has it', async () => {
    await db.bills.put(bill({ id: 'b1', dirty: 1 }))
    api.update.mockRejectedValue(failure(404, 'planning.bill.not_found'))
    const entry = await queue({
      op: 'update',
      entity: 'bill',
      id: 'b1',
      payload: {},
      baseVersion: 'v1',
    })

    await pushBillsEntry(entry)

    expect(await db.bills.get('b1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
  })

  it('leaves anything else to the engine to flag', async () => {
    await db.bills.put(bill({ id: 'b1', dirty: 1 }))
    api.update.mockRejectedValue(failure(422, 'planning.bill.amount_invalid'))
    const entry = await queue({
      op: 'update',
      entity: 'bill',
      id: 'b1',
      payload: {},
      baseVersion: 'v1',
    })

    await expect(pushBillsEntry(entry)).rejects.toBeInstanceOf(ApiError)
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('pullBills', () => {
  it('replaces clean rows, keeps unpushed ones, and drops what the server no longer lists', async () => {
    await db.bills.bulkPut([
      bill({ id: 'clean', name: 'Old', version: 'v1' }),
      bill({ id: 'dirty', name: 'Mine', dirty: 1, version: 'v1' }),
      bill({ id: 'gone', version: 'v1' }),
    ])
    api.list.mockResolvedValue([
      asServer(bill({ id: 'clean', name: 'New' }), 'v2'),
      asServer(bill({ id: 'dirty', name: 'Theirs' }), 'v2'),
      asServer(bill({ id: 'fresh' }), 'v1'),
    ])

    await pullBills()

    expect((await db.bills.get('clean'))?.name).toBe('New')
    expect((await db.bills.get('dirty'))?.name).toBe('Mine')
    expect(await db.bills.get('gone')).toBeUndefined()
    expect(await db.bills.get('fresh')).toBeDefined()
  })
})
