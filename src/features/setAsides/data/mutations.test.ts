import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type {
  CreateSetAsideWire,
  UpdateSetAsideWire,
} from '#/features/setAsides/api/types'
import { bill, m, planned, setAside } from '#/features/planned/testing/fixtures'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const {
  createSetAside,
  deleteSetAside,
  dropSetAsidesOf,
  unreleaseSetAside,
  updateSetAside,
} = await import('./mutations')

const IN_MAIN = {
  source: 'wallet' as const,
  walletId: 'w1',
  externalLabel: 'ignored',
  amount: m(500),
  currency: 'SAR' as const,
  note: null,
}

const queued = () => db.outbox.toArray()

beforeEach(async () => {
  await Promise.all(
    [db.setAsides, db.bills, db.plannedTransactions, db.outbox].map((t) =>
      t.clear(),
    ),
  )
})

describe('createSetAside', () => {
  it('labels money in a wallet for a goal, dropping any outside label', async () => {
    const id = await createSetAside(
      { goalId: 'g1' },
      { ...IN_MAIN, date: '2026-10-25' },
    )

    expect(await db.setAsides.get(id)).toMatchObject({
      goalId: 'g1',
      billId: null,
      occurrence: null,
      source: 'wallet',
      walletId: 'w1',
      externalLabel: null,
      releasedAt: null,
      position: 0,
      date: '2026-10-25',
      dirty: 1,
    })
    const [entry] = await queued()
    expect(entry).toMatchObject({ entity: 'setAside', op: 'create', id })
    expect(entry.payload as CreateSetAsideWire).toMatchObject({
      goal_id: 'g1',
      bill_id: null,
      source: 'WALLET',
      wallet_id: 'w1',
      external_label: null,
      released_at: null,
    })
  })

  it('puts a bill’s set-aside toward its next occurrence unless one is named', async () => {
    await db.bills.put(bill({ id: 'rent', nextDue: '2026-11-01' }))

    const next = await createSetAside({ billId: 'rent' }, IN_MAIN)
    const named = await createSetAside(
      { billId: 'rent', occurrence: '2026-12-01' },
      IN_MAIN,
    )

    expect((await db.setAsides.get(next))?.occurrence).toBe('2026-11-01')
    expect((await db.setAsides.get(named))?.occurrence).toBe('2026-12-01')
    expect((await db.setAsides.get(named))?.position).toBe(1)
  })

  it('holds money outside any wallet under a label', async () => {
    const id = await createSetAside(
      { goalId: 'g1' },
      { ...IN_MAIN, source: 'outside', externalLabel: 'Dad' },
    )
    expect(await db.setAsides.get(id)).toMatchObject({
      source: 'outside',
      walletId: null,
      externalLabel: 'Dad',
    })
  })

  it('closes the planned set-aside it covers', async () => {
    await db.plannedTransactions.put(
      planned({ id: 'p1', goalId: 'g1', amount: m(500) }),
    )
    await createSetAside({ goalId: 'g1' }, { ...IN_MAIN, plannedId: 'p1' })
    expect((await db.plannedTransactions.get('p1'))?.status).toBe('done')
  })
})

describe('updateSetAside / deleteSetAside', () => {
  it('queues a full update on the last-synced version, keeping the owner', async () => {
    await db.setAsides.put(setAside({ id: 'a1', version: 'v1', note: 'Oct' }))

    await updateSetAside('a1', { amount: m(800) })

    const [entry] = await queued()
    expect(entry).toMatchObject({ op: 'update', baseVersion: 'v1' })
    const payload = entry.payload as UpdateSetAsideWire
    expect(payload).toMatchObject({ amount: m(800), note: 'Oct' })
    expect('goal_id' in payload).toBe(false)
  })

  it('re-opens the planned row a deleted set-aside was settling', async () => {
    await db.plannedTransactions.put(
      planned({ id: 'p1', goalId: 'g1', amount: m(500) }),
    )
    const id = await createSetAside(
      { goalId: 'g1' },
      { ...IN_MAIN, plannedId: 'p1' },
    )

    await deleteSetAside(id)

    expect(await db.setAsides.get(id)).toBeUndefined()
    expect((await db.plannedTransactions.get('p1'))?.status).toBe('open')
    // Never synced: nothing goes to the server.
    expect((await queued()).filter((e) => e.entity === 'setAside')).toEqual([])
  })
})

describe('unreleaseSetAside', () => {
  it('makes the released row live again and queues it as an update', async () => {
    await db.setAsides.put(
      setAside({
        id: 'a1',
        version: 'v1',
        releasedAt: '2026-10-04',
        releasedById: 't1',
        movedByTransferId: 'x1',
      }),
    )

    await unreleaseSetAside('a1')

    expect(await db.setAsides.get('a1')).toMatchObject({
      releasedAt: null,
      releasedById: null,
      movedByTransferId: 'x1',
      dirty: 1,
    })
    const [entry] = await queued()
    expect(entry).toMatchObject({ op: 'update', baseVersion: 'v1' })
    expect(entry.payload).toMatchObject({
      version: 'v1',
      released_at: null,
      released_by_id: null,
    })
  })

  it('goes after a queued batch that released the row', async () => {
    await db.setAsides.put(
      setAside({ id: 'a1', releasedAt: '2026-10-04', releasedById: 't1' }),
    )
    await db.outbox.add({
      op: 'release',
      entity: 'setAside',
      id: 'a1',
      alsoRows: [],
      payload: { items: [{ id: 'a1' }] },
      baseVersion: null,
      createdAt: '',
    })

    await unreleaseSetAside('a1')

    expect((await queued()).map((e) => e.op)).toEqual(['release', 'update'])
  })

  it('leaves a live row alone', async () => {
    await db.setAsides.put(setAside({ id: 'a1' }))
    await unreleaseSetAside('a1')
    expect(await queued()).toEqual([])
  })
})

describe('dropSetAsidesOf', () => {
  it('removes an owner’s set-asides and their queued writes, queueing nothing', async () => {
    await db.setAsides.bulkPut([
      setAside({ id: 'a1', goalId: 'g1' }),
      setAside({ id: 'a2', goalId: 'g2' }),
    ])
    await db.outbox.add({
      op: 'update',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: 'v1',
      createdAt: '',
    })

    await dropSetAsidesOf('goalId', 'g1')

    expect((await db.setAsides.toArray()).map((a) => a.id)).toEqual(['a2'])
    expect(await queued()).toEqual([])
  })
})
