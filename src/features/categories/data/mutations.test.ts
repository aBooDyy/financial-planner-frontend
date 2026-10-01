import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import type {
  LocalBudget,
  LocalInboundImport,
  LocalMerchant,
  LocalPlanned,
  LocalRecurring,
  LocalTransaction,
  OutboxEntity,
} from '#/db/types'
import type {
  CreateCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const {
  createCategory,
  createCategoryWithSlug,
  deleteCategory,
  setCategorySpendClass,
  updateCategory,
} = await import('./mutations')

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

describe('createCategoryWithSlug', () => {
  it('reuses a sibling of the same type that owns the slug', async () => {
    const gifts = await createCategory({
      name: 'Gifts',
      type: 'spend',
      color: '#1F9D6B',
    })
    expect(
      await createCategoryWithSlug('gifts', {
        name: 'Gifts',
        type: 'spend',
        color: '#1F9D6B',
      }),
    ).toBe(gifts)
    expect(await db.categories.count()).toBe(1)
  })

  it('takes the next free slug when the owner is of the other type', async () => {
    const spent = await createCategory({
      name: 'Gifts',
      type: 'spend',
      color: '#1F9D6B',
    })
    const received = await createCategoryWithSlug('gifts', {
      name: 'Gifts',
      type: 'income',
      color: '#1F9D6B',
    })
    expect(received).not.toBe(spent)
    expect(await db.categories.get(received)).toMatchObject({
      slug: 'gifts_2',
      type: 'income',
    })
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

  it('always sends the spend class, since an omitted one clears it', async () => {
    const id = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '#1F9D6B',
      spendClass: 'want',
    })
    await markSynced(id)

    await updateCategory(id, { name: 'Eating out' })

    const [entry] = await outbox().toArray()
    const payload = entry.payload as UpdateCategoryWire
    expect(payload.spend_class).toBe('WANT')
  })

  it('tags a spend category and clears the tag again', async () => {
    const id = await createCategory({
      name: 'Rent',
      type: 'spend',
      color: '#1F9D6B',
    })
    expect(
      (
        (await outbox().first())?.payload as CreateCategoryWire | undefined
      )?.spend_class,
    ).toBeNull()
    await markSynced(id)

    await setCategorySpendClass(id, 'need')
    expect((await db.categories.get(id))?.spendClass).toBe('need')

    await setCategorySpendClass(id, null)
    expect((await db.categories.get(id))?.spendClass).toBeNull()
    const [entry] = await outbox().toArray()
    const payload = entry.payload as UpdateCategoryWire
    expect('spend_class' in payload).toBe(true)
    expect(payload.spend_class).toBeNull()
  })

  it('never tags an income category', async () => {
    const id = await createCategory({
      name: 'Salary',
      type: 'income',
      color: '#1F9D6B',
      spendClass: 'need',
    })
    expect((await db.categories.get(id))?.spendClass).toBeNull()
    await markSynced(id)

    await setCategorySpendClass(id, 'want')

    expect((await db.categories.get(id))?.spendClass).toBeNull()
  })

  it('always tells the server where it sits, so an unmoved row stays put', async () => {
    const dining = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '',
    })
    const cafes = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '',
      parentId: dining,
    })
    await markSynced(dining, cafes)

    await updateCategory(cafes, { name: 'Coffee' })

    const [entry] = await outbox().toArray()
    expect((entry.payload as UpdateCategoryWire).parent).toEqual({ id: dining })
  })

  it('moves it to the end of its new siblings and queues the move', async () => {
    const dining = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '',
    })
    const groceries = await createCategory({
      name: 'Groceries',
      type: 'spend',
      color: '',
    })
    const cafes = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '',
      parentId: dining,
    })
    for (const name of ['Bakery', 'Butcher']) {
      await createCategory({
        name,
        type: 'spend',
        color: '',
        parentId: groceries,
      })
    }
    await markSynced(dining, groceries, cafes)

    await updateCategory(cafes, { parentId: groceries })

    expect(await db.categories.get(cafes)).toMatchObject({
      parentId: groceries,
      position: 2,
    })
    const [entry] = await outbox().toArray()
    expect(entry.payload).toMatchObject({
      parent: { id: groceries },
      position: 2,
    })
  })

  it('moves a subcategory to the top level', async () => {
    const dining = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '',
    })
    const cafes = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '',
      parentId: dining,
    })
    await markSynced(dining, cafes)

    await updateCategory(cafes, { parentId: null })

    expect((await db.categories.get(cafes))?.parentId).toBeNull()
    const [entry] = await outbox().toArray()
    expect((entry.payload as UpdateCategoryWire).parent).toEqual({ id: null })
  })

  it('rewrites a still-queued create instead of queueing a move', async () => {
    const dining = await createCategory({
      name: 'Dining',
      type: 'spend',
      color: '',
    })
    const cafes = await createCategory({
      name: 'Cafés',
      type: 'spend',
      color: '',
    })

    await updateCategory(cafes, { parentId: dining })

    const entries = await outbox()
      .filter((e) => e.id === cafes)
      .toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].op).toBe('create')
    expect((entries[0].payload as CreateCategoryWire).parent_id).toBe(dining)
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

const tx = (id: string, categoryId: string): LocalTransaction => ({
  id,
  type: 'spend',
  amount: 2400,
  currency: 'SAR',
  categoryId,
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-06-12',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const recurring = (id: string, categoryId: string): LocalRecurring => ({
  id,
  name: 'Coffee club',
  type: 'spend',
  amount: 5000,
  currency: 'SAR',
  categoryId,
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  endsOn: null,
  note: null,
  frequency: 'monthly',
  customInterval: null,
  customUnit: null,
  nextDue: '2026-10-01',
  autopost: false,
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const budget = (id: string, categoryId: string): LocalBudget => ({
  id,
  scopeType: 'category',
  categoryId,
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: 100000,
  currency: 'SAR',
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const merchant = (id: string, learnedCategoryId: string): LocalMerchant => ({
  id,
  displayName: 'Blue Bottle',
  learnedCategoryId,
  learnedType: 'spend',
  timesSeen: 3,
  timesConfirmed: 2,
  lastSeenAt: null,
  autoCategorize: true,
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const planned = (id: string, categoryId: string): LocalPlanned => ({
  id,
  origin: 'manual',
  role: 'payment',
  goalId: null,
  incomeStreamId: null,
  recurringId: null,
  walletId: 'w1',
  name: 'Coffee',
  amount: 1500,
  currency: 'SAR',
  categoryId,
  occurrence: '2026-10-01',
  date: '2026-10-01',
  status: 'open',
  pinned: false,
  note: null,
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

const pendingImport = (suggestedCategoryId: string): LocalInboundImport => ({
  id: 'i1',
  source: 'webhook',
  connectionId: null,
  keyId: 'k1',
  ruleId: null,
  merchantId: null,
  sourceRef: null,
  sourceLabel: null,
  subject: null,
  occurredOn: '2026-06-12',
  amount: 2400,
  currency: 'SAR',
  suggestedMerchant: null,
  suggestedCategoryId,
  suggestedType: 'spend',
  suggestedWalletId: null,
  rawPreview: null,
  hasBody: false,
  skippable: false,
  bodyFormat: 'text',
  status: 'pending',
  transactionId: null,
  createdAt: '2026-06-12T00:00:00Z',
  version: 'v1',
})

const filedUnder = async (id: string) =>
  (await db.transactions.get(id))?.categoryId

/** Dining › Cafes and Takeaway, Groceries, an income root, and the required Other — synced. */
const seedTree = async () => {
  const spend = { type: 'spend' as const, color: '#1F9D6B' }
  const dining = await createCategory({ name: 'Dining', ...spend })
  const cafes = await createCategory({
    name: 'Cafes',
    ...spend,
    parentId: dining,
  })
  const takeaway = await createCategory({
    name: 'Takeaway',
    ...spend,
    parentId: dining,
  })
  const groceries = await createCategory({ name: 'Groceries', ...spend })
  const other = await createCategory({ name: 'Other', ...spend })
  const salary = await createCategory({
    name: 'Salary',
    type: 'income',
    color: '#1F9D6B',
  })
  await markSynced(dining, cafes, takeaway, groceries, other, salary)
  return { dining, cafes, takeaway, groceries, other, salary }
}

const clearFiled = async () => {
  await Promise.all([
    db.integrationKeys.clear(),
    db.inboundImports.clear(),
    db.transactions.clear(),
    db.recurrings.clear(),
    db.plannedTransactions.clear(),
    db.budgets.clear(),
    db.merchants.clear(),
  ])
}

describe('deleteCategory with a move target', () => {
  beforeEach(clearFiled)

  it('re-files everything under a deleted parent and asks the server to do the same', async () => {
    const { dining, cafes, groceries } = await seedTree()
    await db.transactions.bulkPut([
      tx('t1', cafes),
      tx('t2', dining),
      tx('t3', groceries),
    ])
    await db.recurrings.put(recurring('r1', dining))
    await db.plannedTransactions.put(planned('p1', cafes))

    await deleteCategory(dining, groceries)

    expect(await filedUnder('t1')).toBe(groceries)
    expect(await filedUnder('t2')).toBe(groceries)
    expect(await filedUnder('t3')).toBe(groceries)
    expect((await db.recurrings.get('r1'))?.categoryId).toBe(groceries)
    expect((await db.plannedTransactions.get('p1'))?.categoryId).toBe(groceries)
    // The server re-files synced rows itself; this device queues no per-row edits.
    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      entity: 'category',
      op: 'delete',
      id: dining,
      payload: { move_to: groceries },
    })
  })

  it('moves only the deleted subcategory’s rows', async () => {
    const { dining, cafes, takeaway } = await seedTree()
    await db.transactions.bulkPut([tx('t1', cafes), tx('t2', takeaway)])

    await deleteCategory(cafes, dining)

    expect(await filedUnder('t1')).toBe(dining)
    expect(await filedUnder('t2')).toBe(takeaway)
  })

  it('moves budgets to the target’s root and merchants to the target itself', async () => {
    const { dining, cafes, groceries, other } = await seedTree()
    await db.transactions.put(tx('t1', cafes))
    const bakery = await createCategory({
      name: 'Bakery',
      type: 'spend',
      color: '#1F9D6B',
      parentId: groceries,
    })
    await markSynced(bakery)
    await db.budgets.bulkPut([budget('b1', dining), budget('b2', other)])
    await db.merchants.bulkPut([merchant('m1', cafes), merchant('m2', other)])

    await deleteCategory(dining, bakery)

    expect((await db.budgets.get('b1'))?.categoryId).toBe(groceries)
    expect((await db.budgets.get('b2'))?.categoryId).toBe(other)
    expect((await db.merchants.get('m1'))?.learnedCategoryId).toBe(bakery)
    expect((await db.merchants.get('m2'))?.learnedCategoryId).toBe(other)
    expect(await db.outbox.count()).toBe(1)
  })

  it('rewrites queued payloads so their push does not file the row back', async () => {
    const { dining, cafes, groceries } = await seedTree()
    await db.transactions.put({ ...tx('t1', cafes), dirty: 1 })
    await db.budgets.put({ ...budget('b1', dining), dirty: 1 })
    await db.merchants.put({ ...merchant('m1', cafes), dirty: 1 })
    const queue = (entity: OutboxEntity, id: string, payload: object) =>
      db.outbox.add({
        op: 'create',
        entity,
        id,
        payload: { id, ...payload },
        baseVersion: null,
        createdAt: '2026-06-12T00:00:00Z',
      })
    await queue('transaction', 't1', { category_id: cafes })
    await queue('budget', 'b1', { category_id: dining })
    await queue('merchant', 'm1', { learned_category_id: cafes })

    await deleteCategory(dining, groceries)

    const queued = async (entity: OutboxEntity, id: string) =>
      (await db.outbox.where('[entity+id]').equals([entity, id]).first())
        ?.payload
    expect(await queued('transaction', 't1')).toMatchObject({
      category_id: groceries,
    })
    expect(await queued('budget', 'b1')).toMatchObject({
      category_id: groceries,
    })
    expect(await queued('merchant', 'm1')).toMatchObject({
      learned_category_id: groceries,
    })
  })

  it('queues a moved row again behind its new category when that create is still queued', async () => {
    const { dining, cafes } = await seedTree()
    await db.transactions.put({ ...tx('t1', cafes), dirty: 1 })
    const queueTx = (op: 'create' | 'update', payload: object) =>
      db.outbox.add({
        op,
        entity: 'transaction',
        id: 't1',
        payload,
        baseVersion: null,
        createdAt: '2026-06-12T00:00:00Z',
      })
    await queueTx('create', { id: 't1', category_id: cafes })
    await queueTx('update', { note: 'later', category_id: cafes })
    const coffee = await createCategory({
      name: 'Coffee',
      type: 'spend',
      color: '#1F9D6B',
    })

    await deleteCategory(dining, coffee)

    const order = (await db.outbox.orderBy('seq').toArray()).map((e) => [
      e.entity,
      e.op,
      e.id,
    ])
    expect(order).toEqual([
      ['category', 'create', coffee],
      ['transaction', 'create', 't1'],
      ['transaction', 'update', 't1'],
      ['category', 'delete', dining],
    ])
    const moved = await db.outbox
      .where('entity')
      .equals('transaction')
      .toArray()
    expect(moved.map((e) => e.payload)).toMatchObject([
      { category_id: coffee },
      { note: 'later', category_id: coffee },
    ])
  })

  it('points cached key defaults and import suggestions at the target, or clears them', async () => {
    const { dining, cafes, groceries } = await seedTree()
    await db.transactions.put(tx('t1', cafes))
    await db.integrationKeys.put(aKey({ defaultCategoryId: cafes }))
    await db.inboundImports.put(pendingImport(dining))

    await deleteCategory(dining, groceries)

    expect((await db.integrationKeys.get('k1'))?.defaultCategoryId).toBe(
      groceries,
    )
    expect((await db.inboundImports.get('i1'))?.suggestedCategoryId).toBe(
      groceries,
    )

    await db.transactions.clear()
    await deleteCategory(groceries)
    expect((await db.integrationKeys.get('k1'))?.defaultCategoryId).toBeNull()
    expect((await db.inboundImports.get('i1'))?.suggestedCategoryId).toBeNull()
  })

  it('ignores a target of the other type, then refuses because rows are filed', async () => {
    const { dining, salary } = await seedTree()
    await db.transactions.put(tx('t1', dining))

    await expect(deleteCategory(dining, salary)).rejects.toMatchObject({
      code: 'settings.category.in_use',
    })
    expect(await db.categories.get(dining)).toBeDefined()
  })
})

describe('deleteCategory rules', () => {
  beforeEach(clearFiled)

  it('refuses to delete a category that is in use without a target', async () => {
    const { dining, cafes } = await seedTree()
    await db.plannedTransactions.put(planned('p1', cafes))

    await expect(deleteCategory(dining)).rejects.toMatchObject({
      code: 'settings.category.in_use',
    })
    expect(await db.categories.get(dining)).toBeDefined()
    expect(await db.categories.get(cafes)).toBeDefined()
    expect(await outbox().count()).toBe(0)
  })

  it('does not count a row that is already deleted locally', async () => {
    const { dining } = await seedTree()
    await db.transactions.put({ ...tx('t1', dining), deleted: 1 })

    await deleteCategory(dining)

    expect(await db.categories.get(dining)).toBeUndefined()
  })

  it('never deletes a required root', async () => {
    const { other } = await seedTree()

    await expect(deleteCategory(other)).rejects.toMatchObject({
      code: 'settings.category.required',
    })
    expect(await db.categories.get(other)).toBeDefined()
    expect(await outbox().count()).toBe(0)
  })

  it('without a move, forgets it on merchants and drops its budgets', async () => {
    const { dining, cafes, groceries } = await seedTree()
    await db.budgets.bulkPut([budget('b1', dining), budget('b2', groceries)])
    await db.budgets.put({ ...budget('b3', dining), dirty: 1 })
    await db.outbox.add({
      op: 'create',
      entity: 'budget',
      id: 'b3',
      payload: { id: 'b3', category_id: dining },
      baseVersion: null,
      createdAt: '2026-06-12T00:00:00Z',
    })
    await db.merchants.bulkPut([
      merchant('m1', cafes),
      merchant('m2', groceries),
    ])

    await deleteCategory(dining)

    expect(await db.budgets.get('b1')).toBeUndefined()
    expect(await db.budgets.get('b3')).toBeUndefined()
    expect(await db.budgets.get('b2')).toBeDefined()
    expect((await db.merchants.get('m1'))?.learnedCategoryId).toBeNull()
    expect((await db.merchants.get('m2'))?.learnedCategoryId).toBe(groceries)
    const entries = await db.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      entity: 'category',
      id: dining,
      payload: null,
    })
  })
})
