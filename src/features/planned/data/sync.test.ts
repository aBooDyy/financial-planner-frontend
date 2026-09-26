import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalPlanned, OutboxEntry } from '#/db/types'
import type { Planned } from '#/features/planned/api/types'
import { ApiError } from '#/lib/apiError'
import { planned } from '#/features/planned/testing/fixtures'
import { localPlannedToCreateWire, localPlannedToUpdateWire } from './mappers'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  changes: vi.fn(),
  create: vi.fn(),
  bulkCreate: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('#/features/planned/api/plannedApi', () => ({ plannedApi: api }))

const { pushPlannedCreates, pushPlannedEntry, pullPlanned } =
  await import('./sync')

const asServer = (row: LocalPlanned, over: Partial<Planned> = {}): Planned => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version: 'server-v1', ...over }
}

const conflict = (code: string) =>
  new ApiError({ status: 409, code, message: code })

/** Queue a fresh local row the way the planner does, and return its outbox entry. */
const queueCreate = async (row: LocalPlanned): Promise<OutboxEntry> => {
  await db.plannedTransactions.put({ ...row, dirty: 1 })
  const seq = await db.outbox.add({
    op: 'create',
    entity: 'planned',
    id: row.id,
    payload: localPlannedToCreateWire(row),
    baseVersion: null,
    createdAt: '',
  })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  for (const fn of Object.values(api)) fn.mockReset()
  await Promise.all([db.plannedTransactions.clear(), db.outbox.clear()])
})

describe('pushing a create', () => {
  it('stores the row as the server returns it', async () => {
    const row = planned({ id: 'p1' })
    const entry = await queueCreate(row)
    api.create.mockResolvedValue(asServer(row))

    await pushPlannedEntry(entry)

    expect(await db.plannedTransactions.get('p1')).toMatchObject({
      version: 'server-v1',
      dirty: 0,
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('treats a taken id as another device’s copy of the same occurrence and adopts it', async () => {
    const row = planned({ id: 'p1' })
    const entry = await queueCreate(row)
    api.create.mockRejectedValue(conflict('planned.id_taken'))
    api.list.mockResolvedValue([asServer(row, { walletId: 'w-other' })])

    await pushPlannedEntry(entry)

    expect(api.update).not.toHaveBeenCalled()
    expect(await db.plannedTransactions.get('p1')).toMatchObject({
      walletId: 'w-other',
      version: 'server-v1',
      dirty: 0,
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('re-applies what the user did to this copy before its create went out', async () => {
    const row = planned({ id: 'p1', status: 'done' })
    const entry = await queueCreate(row)
    api.create.mockRejectedValue(conflict('planned.id_taken'))
    api.list.mockResolvedValue([asServer(row, { status: 'open' })])
    api.update.mockResolvedValue(
      asServer(row, { status: 'done', version: 'server-v2' }),
    )

    await pushPlannedEntry(entry)

    expect(api.update).toHaveBeenCalledWith(
      'p1',
      localPlannedToUpdateWire({ ...row, version: 'server-v1' }),
    )
    expect(await db.plannedTransactions.get('p1')).toMatchObject({
      status: 'done',
      version: 'server-v2',
    })
  })

  it('keeps the entry queued when offline', async () => {
    const entry = await queueCreate(planned({ id: 'p1' }))
    api.create.mockRejectedValue(
      new ApiError({ status: 0, code: 'common.network', message: 'offline' }),
    )
    await expect(pushPlannedEntry(entry)).rejects.toBeInstanceOf(ApiError)
    expect(await db.outbox.count()).toBe(1)
  })
})

describe('pushing a run of creates in bulk', () => {
  it('settles each entry on its own terms', async () => {
    const created = planned({ id: 'created' })
    const taken = planned({ id: 'taken' })
    const takenNoRow = planned({ id: 'taken-no-row' })
    const invalid = planned({ id: 'invalid' })
    const unanswered = planned({ id: 'unanswered' })
    const entries = [
      await queueCreate(created),
      await queueCreate(taken),
      await queueCreate(takenNoRow),
      await queueCreate(invalid),
      await queueCreate(unanswered),
    ]
    api.bulkCreate.mockResolvedValue([
      { id: 'created', status: 'created', planned: asServer(created) },
      {
        id: 'taken',
        status: 'taken',
        planned: asServer(taken, { version: 'theirs' }),
      },
      { id: 'taken-no-row', status: 'taken', planned: null },
      {
        id: 'invalid',
        status: 'invalid',
        planned: null,
        errorCode: 'planned.goal_invalid',
        errorField: 'goal_id',
      },
    ])
    api.list.mockResolvedValue([asServer(takenNoRow, { version: 'listed' })])

    await pushPlannedCreates(entries)

    expect(api.bulkCreate).toHaveBeenCalledTimes(1)
    expect((await db.plannedTransactions.get('created'))?.dirty).toBe(0)
    expect((await db.plannedTransactions.get('taken'))?.version).toBe('theirs')
    expect((await db.plannedTransactions.get('taken-no-row'))?.version).toBe(
      'listed',
    )
    expect(api.list).toHaveBeenCalledTimes(1)
    // The refused one is kept and flagged; the unanswered one is simply still queued.
    const left = await db.outbox.toArray()
    expect(left.map((e) => e.id)).toEqual(['invalid', 'unanswered'])
    expect(left[0].failure).toMatchObject({
      kind: 'rejected',
      code: 'planned.goal_invalid',
      field: 'goal_id',
    })
    expect(left[1].failure).toBeUndefined()
  })
})

describe('pushing an update', () => {
  const queueUpdate = async (row: LocalPlanned) => {
    await db.plannedTransactions.put({ ...row, dirty: 1 })
    const seq = await db.outbox.add({
      op: 'update',
      entity: 'planned',
      id: row.id,
      payload: localPlannedToUpdateWire(row),
      baseVersion: row.version,
      createdAt: '',
    })
    return (await db.outbox.get(seq)) as OutboxEntry
  }

  it('rebases once on a version conflict and re-sends the local row', async () => {
    const row = planned({ id: 'p1', version: 'stale', status: 'skipped' })
    const entry = await queueUpdate(row)
    api.update
      .mockRejectedValueOnce(conflict('common.conflict'))
      .mockResolvedValueOnce(asServer(row, { version: 'v3' }))
    api.list.mockResolvedValue([asServer(row, { version: 'v2' })])

    await pushPlannedEntry(entry)

    expect(api.update).toHaveBeenLastCalledWith(
      'p1',
      localPlannedToUpdateWire({ ...row, version: 'v2' }),
    )
    expect((await db.plannedTransactions.get('p1'))?.version).toBe('v3')
  })

  it('drops the row when the server no longer has it', async () => {
    const entry = await queueUpdate(planned({ id: 'p1', version: 'v1' }))
    api.update.mockRejectedValue(
      new ApiError({ status: 404, code: 'planned.not_found', message: '' }),
    )
    await pushPlannedEntry(entry)
    expect(await db.plannedTransactions.get('p1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('pushing a delete', () => {
  it('puts the row back when the server refuses because something settles it', async () => {
    const row = planned({ id: 'p1', origin: 'manual', version: 'v1' })
    const seq = await db.outbox.add({
      op: 'delete',
      entity: 'planned',
      id: 'p1',
      payload: null,
      baseVersion: null,
      createdAt: '',
    })
    api.remove.mockRejectedValue(conflict('planned.has_settlements'))
    api.list.mockResolvedValue([asServer(row)])

    await pushPlannedEntry((await db.outbox.get(seq)) as OutboxEntry)

    expect(await db.plannedTransactions.get('p1')).toMatchObject({ dirty: 0 })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('pulling', () => {
  it('upserts server rows, keeps unpushed local work, drops what the server lost', async () => {
    await db.plannedTransactions.bulkPut([
      planned({ id: 'clean-gone', dirty: 0 }),
      planned({ id: 'dirty-local', dirty: 1, amount: 1 }),
    ])
    api.list.mockResolvedValue([
      asServer(planned({ id: 'fresh' })),
      asServer(planned({ id: 'dirty-local', amount: 999 })),
    ])

    await pullPlanned()

    expect(await db.plannedTransactions.get('clean-gone')).toBeUndefined()
    expect((await db.plannedTransactions.get('dirty-local'))?.amount).toBe(1)
    expect(await db.plannedTransactions.get('fresh')).toMatchObject({
      dirty: 0,
    })
  })
})
