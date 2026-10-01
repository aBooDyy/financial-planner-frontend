import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalBill, LocalSetAside, OutboxEntry } from '#/db/types'
import type { Bill } from '#/features/bills/api/types'
import type { CloseWire, SetAside } from '#/features/setAsides/api/types'
import {
  bill,
  goal,
  m,
  planned,
  setAside,
  tx,
} from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))
const billsApi = vi.hoisted(() => ({
  list: vi.fn(),
  close: vi.fn(),
  reopen: vi.fn(),
}))
vi.mock('#/features/bills/api/billsApi', () => ({ billsApi }))
const setAsidesApi = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('#/features/setAsides/api/setAsidesApi', () => ({ setAsidesApi }))

const { closeBill, reopenBill } = await import('./actions')
const { pushBillsEntry } = await import('./sync')

const CLOSED = '2026-10-15'

const strip = <T extends { dirty: 0 | 1; deleted: 0 | 1 }>(
  row: T,
): Omit<T, 'dirty' | 'deleted'> => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return rest
}
const asServerBill = (row: LocalBill): Bill => strip(row)
const asServerSetAside = (row: LocalSetAside): SetAside => strip(row)
const failure = (status: number, code: string) =>
  new ApiError({ status, code, message: code })

const queued = () => db.outbox.toArray()
const closeEntry = async (): Promise<OutboxEntry> =>
  (await queued()).find((e) => e.op === 'close') as OutboxEntry

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all(
    [
      db.bills,
      db.goals,
      db.setAsides,
      db.plannedTransactions,
      db.transactions,
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.bills.put(bill({ id: 'rent', version: 'v1', nextDue: '2026-11-01' }))
  await db.setAsides.bulkPut([
    setAside({
      id: 'a-live',
      goalId: null,
      billId: 'rent',
      amount: m(1000),
      version: 'v1',
    }),
    setAside({
      id: 'a-old',
      goalId: null,
      billId: 'rent',
      releasedAt: '2026-09-01',
      version: 'v1',
    }),
  ])
})

describe('closeBill', () => {
  it('frees live set-asides, drops future open rows and queues the close', async () => {
    await db.plannedTransactions.bulkPut([
      planned({
        id: 'p-future',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-11-01',
      }),
      planned({
        id: 'p-settled',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-12-01',
      }),
      planned({
        id: 'p-past',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-10-01',
      }),
    ])
    await db.transactions.put(tx({ plannedId: 'p-settled', billId: 'rent' }))
    await db.outbox.add({
      op: 'create',
      entity: 'planned',
      id: 'p-future',
      payload: {},
      baseVersion: null,
      createdAt: '',
    })

    await closeBill('rent', { closedAt: CLOSED })

    expect(await db.bills.get('rent')).toMatchObject({
      closedAt: CLOSED,
      dirty: 1,
      version: 'v1',
    })
    expect(await db.setAsides.get('a-live')).toMatchObject({
      releasedAt: CLOSED,
      dirty: 1,
    })
    expect((await db.setAsides.get('a-old'))?.releasedAt).toBe('2026-09-01')
    expect(await db.plannedTransactions.get('p-future')).toBeUndefined()
    expect(await db.plannedTransactions.get('p-settled')).toBeDefined()
    expect(await db.plannedTransactions.get('p-past')).toBeDefined()
    const entries = await queued()
    expect(entries.map((e) => [e.entity, e.op])).toEqual([['bill', 'close']])
    expect(entries[0].payload).toEqual({ closed_at: CLOSED, leftover: 'FREE' })
  })

  it('moves the leftover to another goal under ids minted here', async () => {
    await db.goals.put(goal({ id: 'trip' }))

    await closeBill('rent', {
      closedAt: CLOSED,
      leftover: { kind: 'move', to: { goalId: 'trip' } },
    })

    const payload = (await closeEntry()).payload as CloseWire
    expect(payload.leftover).toBe('MOVE')
    expect(payload.move_to?.goal_id).toBe('trip')
    const newId = payload.move_to?.new_ids?.['a-live'] as string
    expect(await db.setAsides.get(newId)).toMatchObject({
      goalId: 'trip',
      billId: null,
      occurrence: null,
      amount: m(1000),
      date: CLOSED,
      plannedId: null,
      releasedAt: null,
      dirty: 1,
    })
    expect(Object.keys(payload.move_to?.new_ids ?? {})).toEqual(['a-live'])
  })

  it('puts a leftover moved to a bill toward that bill’s next occurrence', async () => {
    await db.bills.put(bill({ id: 'car', nextDue: '2027-03-01' }))

    await closeBill('rent', {
      closedAt: CLOSED,
      leftover: { kind: 'move', to: { billId: 'car' } },
    })

    const payload = (await closeEntry()).payload as CloseWire
    const newId = payload.move_to?.new_ids?.['a-live'] as string
    expect((await db.setAsides.get(newId))?.occurrence).toBe('2027-03-01')
  })

  it('does nothing for a bill that is already closed', async () => {
    await closeBill('rent', { closedAt: CLOSED })
    await closeBill('rent', { closedAt: '2026-10-20' })
    expect((await queued()).filter((e) => e.op === 'close')).toHaveLength(1)
  })
})

describe('pushing a close', () => {
  it('sends the last-synced version and stores what the server wrote', async () => {
    await closeBill('rent', { closedAt: CLOSED })
    const local = (await db.bills.get('rent')) as LocalBill
    const released = (await db.setAsides.get('a-live')) as LocalSetAside
    billsApi.close.mockResolvedValue({
      bill: asServerBill({ ...local, version: 'v2' }),
      released: [asServerSetAside({ ...released, version: 'v2' })],
      created: [],
    })

    await pushBillsEntry(await closeEntry())

    expect(billsApi.close).toHaveBeenCalledWith('rent', {
      closed_at: CLOSED,
      leftover: 'FREE',
      version: 'v1',
    })
    expect(await db.bills.get('rent')).toMatchObject({
      version: 'v2',
      dirty: 0,
      closedAt: CLOSED,
    })
    expect(await db.setAsides.get('a-live')).toMatchObject({
      version: 'v2',
      dirty: 0,
    })
    expect(await queued()).toEqual([])
  })

  it('takes the server’s state when the bill was already closed elsewhere', async () => {
    await db.goals.put(goal({ id: 'trip' }))
    await closeBill('rent', {
      closedAt: CLOSED,
      leftover: { kind: 'move', to: { goalId: 'trip' } },
    })
    const entry = await closeEntry()
    const copyId = Object.values(
      (entry.payload as CloseWire).move_to?.new_ids ?? {},
    )[0]
    billsApi.close.mockRejectedValue(
      failure(409, 'planning.bill.already_closed'),
    )
    const serverBill = bill({ id: 'rent', closedAt: '2026-10-10' })
    billsApi.list.mockResolvedValue([
      asServerBill({ ...serverBill, version: 'v3' }),
    ])
    const serverLive = setAside({
      id: 'a-live',
      goalId: null,
      billId: 'rent',
      releasedAt: '2026-10-10',
    })
    setAsidesApi.list.mockResolvedValue([
      asServerSetAside({ ...serverLive, version: 'v3' }),
    ])

    await pushBillsEntry(entry)

    expect(await queued()).toEqual([])
    expect(await db.bills.get('rent')).toMatchObject({
      closedAt: '2026-10-10',
      dirty: 0,
    })
    expect((await db.setAsides.get('a-live'))?.releasedAt).toBe('2026-10-10')
    // The copy this device made never reached the server, so it goes.
    expect(await db.setAsides.get(copyId)).toBeUndefined()
  })

  it('retries a stale close once on the fresh version', async () => {
    await closeBill('rent', { closedAt: CLOSED })
    const local = (await db.bills.get('rent')) as LocalBill
    billsApi.close
      .mockRejectedValueOnce(failure(409, 'common.conflict'))
      .mockResolvedValueOnce({
        bill: asServerBill({ ...local, version: 'v3' }),
        released: [],
        created: [],
      })
    billsApi.list.mockResolvedValue([asServerBill({ ...local, version: 'v2' })])

    await pushBillsEntry(await closeEntry())

    expect(billsApi.close).toHaveBeenLastCalledWith(
      'rent',
      expect.objectContaining({ version: 'v2' }),
    )
    expect((await db.bills.get('rent'))?.version).toBe('v3')
  })
})

describe('reopenBill', () => {
  it('reopens locally and settles as done when the server says it is not closed', async () => {
    await db.bills.put(bill({ id: 'rent', version: 'v1', closedAt: CLOSED }))

    await reopenBill('rent')
    expect(await db.bills.get('rent')).toMatchObject({
      closedAt: null,
      dirty: 1,
    })
    const [entry] = await queued()
    expect(entry).toMatchObject({ entity: 'bill', op: 'reopen' })

    billsApi.reopen.mockRejectedValue(failure(409, 'planning.bill.not_closed'))
    billsApi.list.mockResolvedValue([
      asServerBill({ ...bill({ id: 'rent' }), version: 'v2' }),
    ])
    await pushBillsEntry(entry)

    expect(await queued()).toEqual([])
    expect(await db.bills.get('rent')).toMatchObject({
      closedAt: null,
      version: 'v2',
      dirty: 0,
    })
  })
})
