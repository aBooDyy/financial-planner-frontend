import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalCategory, OutboxEntry } from '#/db/types'
import type { Category } from '#/features/categories/api/types'
import { categoryRow } from '#/features/categories/__fixtures__/categories'
import { ApiError } from '#/lib/apiError'
import { localCategoryToCreateWire } from './mappers'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('#/features/categories/api/categoriesApi', () => ({
  categoriesApi: api,
}))

const watermarks = vi.hoisted(() => ({ clearWatermark: vi.fn() }))
vi.mock('#/db/watermarks', () => watermarks)

const templates = vi.hoisted(() => ({ remapTemplateCategories: vi.fn() }))
vi.mock('#/features/import/data/mutations', () => templates)

const { pushCategoryEntry } = await import('./sync')

const asServer = (
  row: LocalCategory,
  over: Partial<Category> = {},
): Category => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version: 'server-v1', ...over }
}

const failure = (status: number, code: string) =>
  new ApiError({ status, code, message: code })

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt' | 'baseVersion'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({
    ...entry,
    baseVersion: null,
    createdAt: '2026-06-12T00:00:00Z',
  })
  return (await db.outbox.get(seq)) as OutboxEntry
}

const queueCreate = async (row: LocalCategory): Promise<OutboxEntry> => {
  await db.categories.put({ ...row, dirty: 1, version: '' })
  return queue({
    op: 'create',
    entity: 'category',
    id: row.id,
    payload: localCategoryToCreateWire(row),
  })
}

beforeEach(async () => {
  for (const fn of Object.values(api)) fn.mockReset()
  watermarks.clearWatermark.mockReset()
  templates.remapTemplateCategories.mockReset()
  await Promise.all([
    db.categories.clear(),
    db.transactions.clear(),
    db.budgets.clear(),
    db.merchants.clear(),
    db.outbox.clear(),
  ])
})

describe('pushing a create whose slug is taken', () => {
  it('remaps everything filed under the local id onto the server’s twin', async () => {
    const local = categoryRow({ id: 'local-dining', slug: 'dining' })
    const child = categoryRow({
      id: 'local-cafes',
      slug: 'cafes',
      parentId: 'local-dining',
    })
    const entry = await queueCreate(local)
    await queueCreate(child)
    await db.transactions.put({
      id: 't1',
      type: 'spend',
      amount: 900,
      currency: 'SAR',
      categoryId: 'local-dining',
      walletId: 'w1',
      goalId: null,
      merchantId: null,
      date: '2026-06-12',
      note: null,
      source: null,
      transferId: null,
      plannedId: null,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 1,
      deleted: 0,
    })
    await queue({
      op: 'create',
      entity: 'transaction',
      id: 't1',
      payload: { id: 't1', category_id: 'local-dining' },
    })
    const twin = asServer(categoryRow({ id: 'server-dining', slug: 'dining' }))
    api.create.mockRejectedValue(failure(409, 'settings.category.slug_taken'))
    api.list.mockResolvedValue([twin])

    await pushCategoryEntry(entry)

    expect(await db.categories.get('local-dining')).toBeUndefined()
    expect(await db.categories.get('server-dining')).toMatchObject({
      dirty: 0,
    })
    expect((await db.transactions.get('t1'))?.categoryId).toBe('server-dining')
    expect((await db.categories.get('local-cafes'))?.parentId).toBe(
      'server-dining',
    )
    const payloadOf = async (entity: OutboxEntry['entity'], id: string) =>
      (await db.outbox.where('[entity+id]').equals([entity, id]).first())
        ?.payload
    expect(await payloadOf('transaction', 't1')).toMatchObject({
      category_id: 'server-dining',
    })
    expect(await payloadOf('category', 'local-cafes')).toMatchObject({
      parent_id: 'server-dining',
    })
    expect(await payloadOf('category', 'local-dining')).toBeUndefined()
    expect(templates.remapTemplateCategories).toHaveBeenCalledWith(
      'local-dining',
      'server-dining',
    )
  })

  it('takes the next free slug and retries when the clash is a root of the other type', async () => {
    const local = categoryRow({
      id: 'local-gifts',
      slug: 'gifts',
      type: 'income',
    })
    const entry = await queueCreate(local)
    const spent = asServer(categoryRow({ id: 'server-gifts', slug: 'gifts' }))
    api.create.mockRejectedValue(failure(409, 'settings.category.slug_taken'))
    api.list.mockResolvedValue([spent])

    await pushCategoryEntry(entry)

    expect((await db.categories.get('local-gifts'))?.slug).toBe('gifts_2')
    expect((await db.outbox.get(entry.seq))?.payload).toMatchObject({
      id: 'local-gifts',
      slug: 'gifts_2',
    })
    expect(templates.remapTemplateCategories).not.toHaveBeenCalled()
  })

  it('adopts the server row when it already holds this id', async () => {
    const local = categoryRow({ id: 'c1', slug: 'dining' })
    const entry = await queueCreate(local)
    api.create.mockRejectedValue(failure(409, 'settings.category.id_taken'))
    api.list.mockResolvedValue([asServer(local, { name: 'Dining out' })])

    await pushCategoryEntry(entry)

    expect(await db.categories.get('c1')).toMatchObject({
      name: 'Dining out',
      dirty: 0,
    })
    expect(await db.outbox.count()).toBe(0)
    expect(templates.remapTemplateCategories).not.toHaveBeenCalled()
  })
})

describe('pushing a delete', () => {
  const queueDelete = (moveTo: string | null) =>
    queue({
      op: 'delete',
      entity: 'category',
      id: 'c1',
      payload: moveTo ? { move_to: moveTo } : null,
    })

  it('sends the move target', async () => {
    const entry = await queueDelete('c2')
    api.remove.mockResolvedValue(undefined)

    await pushCategoryEntry(entry)

    expect(api.remove).toHaveBeenCalledWith('c1', 'c2')
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the server’s category when it refuses the delete as in use', async () => {
    const entry = await queueDelete(null)
    api.remove.mockRejectedValue(failure(409, 'settings.category.in_use'))
    api.list.mockResolvedValue([])

    await pushCategoryEntry(entry)

    // The refusal is the server's answer, not a failure to retry: the op goes, the row returns.
    expect(await db.outbox.count()).toBe(0)
    expect(api.list).toHaveBeenCalled()
    const cleared = watermarks.clearWatermark.mock.calls.map(([e]) => e)
    expect(cleared).toEqual(
      expect.arrayContaining(['transaction', 'planned', 'merchant']),
    )
  })

  it('forgets the rewritten watermarks and rethrows any other refusal', async () => {
    const entry = await queueDelete('gone')
    api.remove.mockRejectedValue(
      failure(422, 'settings.category.move_target_invalid'),
    )

    await expect(pushCategoryEntry(entry)).rejects.toBeInstanceOf(ApiError)

    expect(await db.outbox.count()).toBe(1)
    const cleared = watermarks.clearWatermark.mock.calls.map(([e]) => e)
    expect(cleared).toEqual(
      expect.arrayContaining(['transaction', 'planned', 'merchant']),
    )
  })

  it('leaves the watermarks alone when the network is down', async () => {
    const entry = await queueDelete('c2')
    api.remove.mockRejectedValue(failure(0, 'common.network'))

    await expect(pushCategoryEntry(entry)).rejects.toBeInstanceOf(ApiError)

    expect(watermarks.clearWatermark).not.toHaveBeenCalled()
  })
})
