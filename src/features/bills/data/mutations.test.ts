import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { CreateBillWire, UpdateBillWire } from '#/features/bills/api/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { bill, m, setAside, tx } from '#/features/planned/testing/fixtures'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { createBill, deleteBill, updateBill } = await import('./mutations')

const RENT = {
  name: 'Rent',
  amount: m(3000),
  currency: 'SAR' as const,
  frequency: 'monthly' as const,
  nextDue: '2026-11-01',
  walletId: 'w1',
  categoryId: catId('housing'),
  color: '#8B5CF6',
}

const queued = () => db.outbox.toArray()

beforeEach(async () => {
  await Promise.all(
    [db.bills, db.setAsides, db.transactions, db.outbox].map((t) => t.clear()),
  )
})

describe('createBill', () => {
  it('writes the row and queues a create with the server’s defaults filled in', async () => {
    const id = await createBill(RENT)

    expect(await db.bills.get(id)).toMatchObject({
      mustPay: true,
      autopay: false,
      closedAt: null,
      position: 0,
      dirty: 1,
      version: '',
    })
    const [entry] = await queued()
    expect(entry).toMatchObject({ entity: 'bill', op: 'create', id })
    expect(entry.payload as CreateBillWire).toMatchObject({
      id,
      frequency: 'MONTHLY',
      custom_interval: null,
      custom_unit: null,
      next_due: '2026-11-01',
      must_pay: true,
      autopay: false,
      category_id: catId('housing'),
    })
  })

  it('keeps an end date only on a repeating bill and an interval only on a custom one', async () => {
    const once = await createBill({
      ...RENT,
      frequency: null,
      endsOn: '2027-01-01',
      customInterval: 3,
      customUnit: 'month',
    })
    expect(await db.bills.get(once)).toMatchObject({
      frequency: null,
      endsOn: null,
      customInterval: null,
      customUnit: null,
    })

    const custom = await createBill({
      ...RENT,
      frequency: 'custom',
      customInterval: 28,
      customUnit: 'day',
    })
    const entry = (await queued()).find((e) => e.id === custom)
    expect(entry?.payload as CreateBillWire).toMatchObject({
      frequency: 'CUSTOM',
      custom_interval: 28,
      custom_unit: 'DAY',
    })
  })
})

describe('updateBill', () => {
  it('folds an edit into a still-queued create', async () => {
    const id = await createBill(RENT)
    await updateBill(id, { amount: m(3200) })

    const entries = await queued()
    expect(entries).toHaveLength(1)
    expect(entries[0].op).toBe('create')
    expect((entries[0].payload as CreateBillWire).amount).toBe(m(3200))
  })

  it('queues a full representation on the last-synced version', async () => {
    await db.bills.put(bill({ id: 'b1', version: 'v1', note: 'Flat 4' }))

    await updateBill('b1', { nextDue: '2026-12-01' })

    const [entry] = await queued()
    expect(entry).toMatchObject({ op: 'update', baseVersion: 'v1' })
    expect(entry.payload as UpdateBillWire).toMatchObject({
      version: 'v1',
      next_due: '2026-12-01',
      // Untouched fields still go: an omitted one would be cleared.
      note: 'Flat 4',
      must_pay: true,
    })
  })
})

describe('deleteBill', () => {
  it('drops a never-synced bill without telling the server', async () => {
    const id = await createBill(RENT)
    await deleteBill(id)
    expect(await db.bills.get(id)).toBeUndefined()
    expect(await queued()).toEqual([])
  })

  it('takes its set-asides along and unlinks its payments, as the server does', async () => {
    await db.bills.put(bill({ id: 'b1', version: 'v1' }))
    await db.setAsides.bulkPut([
      setAside({ id: 'a1', goalId: null, billId: 'b1' }),
      setAside({ id: 'a2', goalId: 'g1' }),
    ])
    await db.outbox.add({
      op: 'create',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: null,
      createdAt: '',
    })
    await db.transactions.put(tx({ id: 't1', billId: 'b1', amount: m(3000) }))
    await db.outbox.add({
      op: 'update',
      entity: 'transaction',
      id: 't1',
      payload: { bill_id: 'b1', amount: m(3000) },
      baseVersion: 'v1',
      createdAt: '',
    })

    await deleteBill('b1')

    expect(await db.setAsides.get('a1')).toBeUndefined()
    expect(await db.setAsides.get('a2')).toBeDefined()
    expect((await db.transactions.get('t1'))?.billId).toBeNull()
    const entries = await queued()
    expect(entries.map((e) => [e.entity, e.op])).toEqual([
      ['transaction', 'update'],
      ['bill', 'delete'],
    ])
    expect(entries[0].payload).toEqual({ bill_id: null, amount: m(3000) })
  })
})
