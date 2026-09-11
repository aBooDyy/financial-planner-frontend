import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalCategory } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'
import { localCategoryToCreateWire, localCategoryToUpdateWire } from './mappers'
import { slugify } from './slug'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export type CategoryDraft = {
  name: string
  type: TxType
  color: string
}

export type CategoryPatch = Partial<{
  name: string
  color: string
  position: number
}>

const liveCategories = async (): Promise<LocalCategory[]> =>
  (await db.categories.toArray()).filter((c) => c.deleted === 0)

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  const taken = new Set((await liveCategories()).map((c) => c.slug))
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}_${newId().slice(0, 6)}`
}

async function nextPosition(): Promise<number> {
  const all = await liveCategories()
  return all.reduce((max, c) => Math.max(max, c.position), -1) + 1
}

// --- Outbox helpers ------------------------------------------------------------------

const pending = (entity: 'category' | 'rate', id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

async function enqueueCategoryUpsert(category: LocalCategory): Promise<void> {
  const entries = await pending('category', category.id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    create.payload = localCategoryToCreateWire(category)
    await db.outbox.put(create)
    return
  }
  const update = entries.find((e) => e.op === 'update')
  const payload = localCategoryToUpdateWire(category)
  if (update) {
    update.payload = payload
    update.baseVersion = category.version
    await db.outbox.put(update)
    return
  }
  await db.outbox.add({
    op: 'update',
    entity: 'category',
    id: category.id,
    payload,
    baseVersion: category.version,
    createdAt: now(),
  })
}

// --- Categories ----------------------------------------------------------------------

export async function createCategory(draft: CategoryDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const category: LocalCategory = {
    id,
    slug: await uniqueSlug(draft.name),
    name: draft.name.trim(),
    type: draft.type,
    color: draft.color,
    position: await nextPosition(),
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.put(category)
    await db.outbox.add({
      op: 'create',
      entity: 'category',
      id,
      payload: localCategoryToCreateWire(category),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return
  const category: LocalCategory = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    color: patch.color ?? existing.color,
    position: patch.position ?? existing.position,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.put(category)
    await enqueueCategoryUpsert(category)
  })
  schedulePush()
}

export async function deleteCategory(id: string): Promise<void> {
  const entries = await pending('category', id).toArray()
  const neverSynced = entries.some((e) => e.op === 'create')
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await pending('category', id).delete()
    await db.categories.delete(id)
    if (!neverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity: 'category',
        id,
        payload: null,
        baseVersion: null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}

// --- Exchange rates ------------------------------------------------------------------

/** Set the user's FX rate for one currency. Copy-on-write: the edit stays local-dirty until
 *  the sync engine pushes it, so a background pull won't clobber it. */
export async function setExchangeRate(
  currency: CurrencyCode,
  rate: number,
): Promise<void> {
  const existing = await db.exchangeRates.get(currency)
  if (!existing) return
  const next = { ...existing, rate, updatedAt: now(), dirty: 1 as const }
  const payload = { version: existing.version, rate: String(rate) }
  await db.transaction('rw', db.exchangeRates, db.outbox, async () => {
    await db.exchangeRates.put(next)
    const open = await pending('rate', currency).first()
    if (open) {
      open.payload = payload
      await db.outbox.put(open)
    } else {
      await db.outbox.add({
        op: 'update',
        entity: 'rate',
        id: currency,
        payload,
        baseVersion: existing.version,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}
