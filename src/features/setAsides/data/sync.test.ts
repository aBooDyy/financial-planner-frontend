import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalSetAside, OutboxEntry } from '#/db/types'
import type { SetAside } from '#/features/setAsides/api/types'
import { setAside } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
}))
vi.mock('#/features/setAsides/api/setAsidesApi', () => ({
  setAsidesApi: api,
}))

const { pullSetAsides, pushSetAsidesEntry } = await import('./sync')

const asServer = (row: LocalSetAside, version: string): SetAside => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({ ...entry, createdAt: '' })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.setAsides.clear(), db.outbox.clear()])
})

describe('pushSetAsidesEntry', () => {
  it('adopts the server row when a create’s id is already taken', async () => {
    const local = setAside({ id: 'a1', dirty: 1, version: '' })
    await db.setAsides.put(local)
    api.create.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'planning.set_aside.id_taken',
        message: '',
      }),
    )
    api.list.mockResolvedValue([asServer(local, 'v1')])
    const entry = await queue({
      op: 'create',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: null,
    })

    await pushSetAsidesEntry(entry)

    expect(await db.outbox.count()).toBe(0)
    // Still dirty locally, so the pull leaves it for its own next write to settle.
    expect((await db.setAsides.get('a1'))?.id).toBe('a1')
  })

  it('never un-releases a row another device released while rebasing an edit', async () => {
    const local = setAside({ id: 'a1', dirty: 1, version: 'v1', note: 'mine' })
    await db.setAsides.put(local)
    const fresh = asServer(
      {
        ...local,
        note: null,
        releasedAt: '2026-10-01',
        releasedById: 't9',
        movedByTransferId: 'x1',
      },
      'v2',
    )
    api.update
      .mockRejectedValueOnce(
        new ApiError({ status: 409, code: 'common.conflict', message: '' }),
      )
      .mockImplementationOnce((_id: string, body: Record<string, unknown>) =>
        Promise.resolve({ ...fresh, note: body.note, version: 'v3' }),
      )
    api.list.mockResolvedValue([fresh])
    const entry = await queue({
      op: 'update',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: 'v1',
    })

    await pushSetAsidesEntry(entry)

    expect(api.update.mock.calls[1][1]).toMatchObject({
      version: 'v2',
      note: 'mine',
      released_at: '2026-10-01',
      released_by_id: 't9',
      moved_by_transfer_id: 'x1',
    })
    expect(await db.setAsides.get('a1')).toMatchObject({
      releasedAt: '2026-10-01',
      dirty: 0,
    })
  })

  it('treats a delete the server already applied as done', async () => {
    await db.setAsides.put(setAside({ id: 'a1' }))
    api.del.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'planning.set_aside.not_found',
        message: '',
      }),
    )
    const entry = await queue({
      op: 'delete',
      entity: 'setAside',
      id: 'a1',
      payload: null,
      baseVersion: null,
    })

    await pushSetAsidesEntry(entry)

    expect(await db.setAsides.get('a1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('pullSetAsides', () => {
  it('keeps released rows as history and drops what the server no longer lists', async () => {
    await db.setAsides.bulkPut([
      setAside({ id: 'gone', version: 'v1' }),
      setAside({ id: 'mine', dirty: 1, amount: 1 }),
    ])
    api.list.mockResolvedValue([
      asServer(setAside({ id: 'released', releasedAt: '2026-10-01' }), 'v1'),
      asServer(setAside({ id: 'mine', amount: 2 }), 'v2'),
    ])

    await pullSetAsides()

    expect(await db.setAsides.get('gone')).toBeUndefined()
    expect((await db.setAsides.get('released'))?.releasedAt).toBe('2026-10-01')
    expect((await db.setAsides.get('mine'))?.amount).toBe(1)
  })
})
