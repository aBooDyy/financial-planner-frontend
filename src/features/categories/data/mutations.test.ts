import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type {
  CreateCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { createCategory, deleteCategory, updateCategory } =
  await import('./mutations')

const outbox = () => db.outbox.where('entity').equals('category')

/** Pretend the sync engine pushed everything queued so far. */
const markSynced = async (...ids: string[]) => {
  await db.outbox.clear()
  for (const id of ids)
    await db.categories.update(id, { version: 'v1', dirty: 0 })
}

beforeEach(async () => {
  await db.categories.clear()
  await db.outbox.clear()
})

describe('createCategory', () => {
  it('creates a root with its own slug and position', async () => {
    const id = await createCategory({
      name: '  Dining Out  ',
      type: 'spend',
      color: '#1F9D6B',
    })

    expect(await db.categories.get(id)).toMatchObject({
      parentId: null,
      slug: 'dining_out',
      name: 'Dining Out',
      type: 'spend',
      icon: null,
      position: 0,
      dirty: 1,
    })
  })

  it('files a child under its parent, inheriting the type', async () => {
    const parent = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
    })

    // The caller's `type` is ignored for a child — the parent decides.
    const child = await createCategory({
      name: 'Cafés',
      type: 'income',
      color: '#123456',
      parentId: parent,
      icon: 'coffee',
    })

    expect(await db.categories.get(child)).toMatchObject({
      parentId: parent,
      slug: 'caf_s',
      type: 'spend',
      color: '#123456',
      icon: 'coffee',
      position: 0,
    })

    const payload = (await outbox().toArray()).find((e) => e.id === child)
      ?.payload as CreateCategoryWire
    expect(payload).toMatchObject({
      parent_id: parent,
      type: 'SPEND',
      icon: 'coffee',
    })
  })

  it('takes the parent colour when the draft leaves it blank', async () => {
    const parent = await createCategory({
      name: 'Transport',
      type: 'spend',
      color: '#1F9D6B',
    })
    const child = await createCategory({
      name: 'Taxi',
      type: 'spend',
      color: '  ',
      parentId: parent,
    })

    expect((await db.categories.get(child))?.color).toBe('#1F9D6B')
  })

  it('uniquifies a slug among that parent’s children only', async () => {
    const dining = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
    })
    const transport = await createCategory({
      name: 'Transport',
      type: 'spend',
      color: '#1F9D6B',
    })
    // A root already owns `other` — a child of Dining may still take it.
    await createCategory({ name: 'Other', type: 'spend', color: '#1F9D6B' })

    const diningOther = await createCategory({
      name: 'Other',
      type: 'spend',
      color: '#1F9D6B',
      parentId: dining,
    })
    const transportOther = await createCategory({
      name: 'Other',
      type: 'spend',
      color: '#1F9D6B',
      parentId: transport,
    })
    const diningOther2 = await createCategory({
      name: 'Other',
      type: 'spend',
      color: '#1F9D6B',
      parentId: dining,
    })

    expect((await db.categories.get(diningOther))?.slug).toBe('other')
    expect((await db.categories.get(transportOther))?.slug).toBe('other')
    // Only a collision with a *sibling* forces a suffix.
    expect((await db.categories.get(diningOther2))?.slug).toBe('other_2')
    expect((await db.categories.get(diningOther2))?.position).toBe(1)
  })
})

describe('updateCategory', () => {
  it('clears the icon and enqueues an update carrying icon: null', async () => {
    const id = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
      icon: 'fork-knife',
    })
    await markSynced(id)

    await updateCategory(id, { icon: null })

    expect((await db.categories.get(id))?.icon).toBeNull()
    const [entry] = await outbox().toArray()
    expect(entry).toMatchObject({ op: 'update', baseVersion: 'v1' })
    const payload = entry.payload as UpdateCategoryWire
    // `icon` is replace-on-PATCH: the key has to be present, and it has to be null.
    expect(payload.icon).toBeNull()
    expect('icon' in payload).toBe(true)
  })

  it('leaves the icon alone when the patch does not mention it', async () => {
    const id = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
      icon: 'fork-knife',
    })
    await markSynced(id)

    await updateCategory(id, { name: 'Eating out' })

    expect((await db.categories.get(id))?.icon).toBe('fork-knife')
    const [entry] = await outbox().toArray()
    expect((entry.payload as UpdateCategoryWire).icon).toBe('fork-knife')
  })
})

describe('deleteCategory', () => {
  it('removes the children with the parent and enqueues one delete', async () => {
    const parent = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
    })
    const a = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '#1F9D6B',
      parentId: parent,
    })
    const b = await createCategory({
      name: 'Bars',
      type: 'spend',
      color: '#1F9D6B',
      parentId: parent,
    })
    const other = await createCategory({
      name: 'Transport',
      type: 'spend',
      color: '#1F9D6B',
    })
    await markSynced(parent, a, b, other)

    // A pending edit on a child must not outlive it.
    await updateCategory(a, { name: 'Coffee' })
    expect(await outbox().count()).toBe(1)

    await deleteCategory(parent)

    expect(await db.categories.get(parent)).toBeUndefined()
    expect(await db.categories.get(a)).toBeUndefined()
    expect(await db.categories.get(b)).toBeUndefined()
    expect(await db.categories.get(other)).toBeDefined()

    const entries = await outbox().toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ op: 'delete', id: parent })
  })

  it('leaves nothing queued when neither the parent nor its child was ever synced', async () => {
    const parent = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
    })
    await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '#1F9D6B',
      parentId: parent,
    })

    await deleteCategory(parent)

    expect(await db.categories.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('drops a synced child on its own without touching its parent', async () => {
    const parent = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
    })
    const child = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '#1F9D6B',
      parentId: parent,
    })
    await markSynced(parent, child)

    await deleteCategory(child)

    expect(await db.categories.get(parent)).toBeDefined()
    const entries = await outbox().toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ op: 'delete', id: child })
  })
})
