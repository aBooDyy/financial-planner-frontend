import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalSetAside, OutboxEntry } from '#/db/types'
import type {
  MoveWire,
  ReleaseWire,
  SetAside,
} from '#/features/setAsides/api/types'
import { bill, m, setAside } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'
import { useAppConfigStore } from '#/lib/config/appConfig'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  release: vi.fn(),
  move: vi.fn(),
}))
vi.mock('#/features/setAsides/api/setAsidesApi', () => ({
  setAsidesApi: api,
}))

const { flushOutbox } = await import('#/db/sync')
const { moveSetAsides, releaseSetAsides, SetAsideBatchError } =
  await import('./batches')
const { pushSetAsidesEntry } = await import('./sync')
const { updateSetAside } = await import('./mutations')

const asServer = (row: LocalSetAside, version = 'v2'): SetAside => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}
const queued = () => db.outbox.toArray()
const onlyEntry = async (): Promise<OutboxEntry> => {
  const [entry] = await queued()
  return entry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.setAsides, db.bills, db.outbox].map((t) => t.clear()))
  await db.setAsides.bulkPut([
    setAside({
      id: 'a1',
      goalId: 'g1',
      walletId: 'w1',
      amount: m(500),
      plannedId: 'p1',
      version: 'v1',
    }),
    setAside({ id: 'a2', goalId: 'g1', amount: m(300), version: 'v1' }),
  ])
})

describe('releaseSetAsides', () => {
  it('releases whole rows and splits a part, queueing one batch over every row', async () => {
    await releaseSetAsides([{ id: 'a1', amount: m(200) }, { id: 'a2' }], {
      releasedAt: '2026-11-01',
      releasedById: 't1',
    })

    expect(await db.setAsides.get('a1')).toMatchObject({
      amount: m(200),
      releasedAt: '2026-11-01',
      releasedById: 't1',
      dirty: 1,
    })
    expect(await db.setAsides.get('a2')).toMatchObject({
      amount: m(300),
      releasedAt: '2026-11-01',
    })
    const entry = await onlyEntry()
    const payload = entry.payload as ReleaseWire
    const remainderId = payload.items[0].remainder_id as string
    expect(await db.setAsides.get(remainderId)).toMatchObject({
      goalId: 'g1',
      walletId: 'w1',
      amount: m(300),
      plannedId: 'p1',
      releasedAt: null,
      dirty: 1,
    })
    expect(payload).toEqual({
      released_at: '2026-11-01',
      released_by_id: 't1',
      items: [
        { id: 'a1', amount: m(200), remainder_id: remainderId },
        { id: 'a2' },
      ],
    })
    expect(entry).toMatchObject({ op: 'release', entity: 'setAside', id: 'a1' })
    expect(new Set(entry.alsoRows)).toEqual(new Set([remainderId, 'a2']))
  })

  it('refuses a row that is not live, writing nothing', async () => {
    await db.setAsides.update('a2', { releasedAt: '2026-10-01' })
    await expect(
      releaseSetAsides([{ id: 'a1' }, { id: 'a2' }]),
    ).rejects.toBeInstanceOf(SetAsideBatchError)
    expect((await db.setAsides.get('a1'))?.releasedAt).toBeNull()
    expect(await queued()).toEqual([])
  })
})

describe('moveSetAsides', () => {
  it('moves part of a row to another wallet, keeping its owner and planned link', async () => {
    await moveSetAsides(
      [{ id: 'a1', amount: m(100), to: { walletId: 'w2' } }],
      {
        date: '2026-10-26',
        transferId: 'tr1',
      },
    )

    const payload = (await onlyEntry()).payload as MoveWire
    const [item] = payload.items
    expect(payload).toMatchObject({ date: '2026-10-26', transfer_id: 'tr1' })
    expect(item).toMatchObject({
      id: 'a1',
      amount: m(100),
      to: { wallet_id: 'w2' },
    })
    expect(await db.setAsides.get('a1')).toMatchObject({
      amount: m(100),
      releasedAt: '2026-10-26',
      movedByTransferId: 'tr1',
    })
    expect(await db.setAsides.get(item.new_id)).toMatchObject({
      goalId: 'g1',
      walletId: 'w2',
      source: 'wallet',
      amount: m(100),
      date: '2026-10-26',
      plannedId: 'p1',
      movedByTransferId: 'tr1',
      releasedAt: null,
    })
    expect((await db.setAsides.get(item.remainder_id as string))?.amount).toBe(
      m(400),
    )
  })

  it('moves a row to a bill, dropping the planned link and covering its next due', async () => {
    await db.bills.put(bill({ id: 'rent', nextDue: '2026-12-01' }))

    await moveSetAsides([{ id: 'a1', to: { owner: { billId: 'rent' } } }])

    const [item] = ((await onlyEntry()).payload as MoveWire).items
    expect(item.to).toEqual({ bill_id: 'rent' })
    expect(await db.setAsides.get(item.new_id)).toMatchObject({
      goalId: null,
      billId: 'rent',
      occurrence: '2026-12-01',
      plannedId: null,
      amount: m(500),
    })
  })
})

describe('pushing a batch', () => {
  it('stores what the server wrote, but not over a newer queued edit', async () => {
    await releaseSetAsides([{ id: 'a1' }, { id: 'a2' }], {
      releasedAt: '2026-11-01',
    })
    await updateSetAside('a2', { note: 'later edit' })
    const a1 = (await db.setAsides.get('a1')) as LocalSetAside
    const a2 = (await db.setAsides.get('a2')) as LocalSetAside
    api.release.mockResolvedValue({
      released: [asServer(a1), asServer({ ...a2, note: null })],
      created: [],
    })

    const batch = (await queued()).find(
      (e) => e.op === 'release',
    ) as OutboxEntry
    await pushSetAsidesEntry(batch)

    expect(await db.setAsides.get('a1')).toMatchObject({
      version: 'v2',
      dirty: 0,
    })
    // The edit queued after the batch is kept, and goes out on its own.
    expect((await db.setAsides.get('a2'))?.note).toBe('later edit')
    expect((await queued()).map((e) => [e.id, e.op])).toEqual([
      ['a2', 'update'],
    ])
  })

  it('takes the server’s rows when a source was already released elsewhere', async () => {
    await releaseSetAsides([{ id: 'a1', amount: m(200) }])
    const entry = await onlyEntry()
    const remainderId = (entry.payload as ReleaseWire).items[0]
      .remainder_id as string
    api.release.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'planning.set_aside.already_released',
        message: '',
      }),
    )
    const serverA1 = setAside({
      id: 'a1',
      goalId: 'g1',
      amount: m(500),
      releasedAt: '2026-10-30',
    })
    api.list.mockResolvedValue([
      asServer(serverA1, 'v9'),
      asServer((await db.setAsides.get('a2')) as LocalSetAside, 'v1'),
    ])

    await pushSetAsidesEntry(entry)

    expect(await queued()).toEqual([])
    expect(await db.setAsides.get('a1')).toMatchObject({
      amount: m(500),
      releasedAt: '2026-10-30',
      dirty: 0,
    })
    expect(await db.setAsides.get(remainderId)).toBeUndefined()
  })

  it('waits behind a failed write of any row it touches', async () => {
    await db.outbox.add({
      op: 'update',
      entity: 'setAside',
      id: 'a2',
      payload: { version: 'v1' },
      baseVersion: 'v1',
      createdAt: '',
    })
    await releaseSetAsides([{ id: 'a1' }, { id: 'a2' }])
    api.update.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'planning.set_aside.amount_invalid',
        message: '',
      }),
    )

    await flushOutbox()

    expect(api.update).toHaveBeenCalled()
    expect(api.release).not.toHaveBeenCalled()
    expect((await queued()).map((e) => e.op)).toEqual(['update', 'release'])
  })
})

describe('batch size', () => {
  it('queues more parts than the server takes as several batches', async () => {
    const limits = useAppConfigStore.getState().config.limits
    useAppConfigStore.setState((st) => ({
      config: { ...st.config, limits: { ...limits, setAsideBatchMax: 1 } },
    }))
    try {
      await releaseSetAsides([{ id: 'a1' }, { id: 'a2' }])
    } finally {
      useAppConfigStore.setState((st) => ({ config: { ...st.config, limits } }))
    }

    const entries = await queued()
    expect(entries.map((e) => [e.op, e.id])).toEqual([
      ['release', 'a1'],
      ['release', 'a2'],
    ])
    expect(
      entries.map((e) => (e.payload as ReleaseWire).items.map((i) => i.id)),
    ).toEqual([['a1'], ['a2']])
  })
})
