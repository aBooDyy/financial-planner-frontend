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
