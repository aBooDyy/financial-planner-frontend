import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalCategory } from '#/db/types'
import type { DeleteCategoryWire } from '#/features/categories/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { localCategoryToCreateWire, localCategoryToUpdateWire } from './mappers'
import { filingOf, refileLocally, refileTables } from './refile'
import { slugify } from './slug'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export type CategoryDraft = {
  name: string
  type: TxType
  color: string
  /** `null`/omitted creates a top-level category; an id creates a child of that category. */
  parentId?: string | null
  icon?: string | null
}

export type CategoryPatch = Partial<{
  name: string
  color: string
  /** `null` clears the icon back to the default for the row's type. */
  icon: string | null
  position: number
}>

const liveCategories = async (): Promise<LocalCategory[]> =>
  (await db.categories.toArray()).filter((c) => c.deleted === 0)

const siblingsOf = async (parentId: string | null): Promise<LocalCategory[]> =>
  (await liveCategories()).filter((c) => c.parentId === parentId)

/** Slugs are unique among siblings only: two parents may each own an `other`. */
async function uniqueSlug(
  name: string,
  parentId: string | null,
): Promise<string> {
  const base = slugify(name)
  const taken = new Set((await siblingsOf(parentId)).map((c) => c.slug))
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}_${newId().slice(0, 6)}`
}

async function nextPosition(parentId: string | null): Promise<number> {
  const siblings = await siblingsOf(parentId)
  return siblings.reduce((max, c) => Math.max(max, c.position), -1) + 1
}

// --- Outbox helpers ------------------------------------------------------------------

const pending = (id: string) =>
  db.outbox.where('[entity+id]').equals(['category', id])

async function enqueueCategoryUpsert(category: LocalCategory): Promise<void> {
  const entries = await pending(category.id).toArray()
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

// --- Public mutations ----------------------------------------------------------------

export async function createCategory(draft: CategoryDraft): Promise<string> {
  const parentId = draft.parentId ?? null
  return createCategoryWithSlug(await uniqueSlug(draft.name, parentId), draft)
}

/**
 * Create a category under a caller-supplied slug. The importer files rows by slug and picks
 * one while mapping, so the rows are final before anything is written. A slug already used
 * by a sibling is left alone — those rows then file under the category that already owns it.
 */
export async function createCategoryWithSlug(
  slug: string,
  draft: CategoryDraft,
): Promise<string> {
  const parentId = draft.parentId ?? null
  const owner = (await siblingsOf(parentId)).find((c) => c.slug === slug)
  if (owner) return owner.id

  // A child's type is its parent's, and a blank colour means "the parent's" — both are what
  // the server decides on create, so the local row has to agree or the next pull flips it.
  const parent = parentId ? await db.categories.get(parentId) : undefined
  const id = newId()
  const ts = now()
  const category: LocalCategory = {
    id,
    parentId,
    slug,
    name: draft.name.trim(),
    type: parent?.type ?? draft.type,
    color: draft.color.trim() || (parent?.color ?? draft.color),
    icon: draft.icon ?? null,
    position: await nextPosition(parentId),
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
    icon: patch.icon !== undefined ? patch.icon : existing.icon,
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

/**
 * Delete a category and, when it is a parent, its children with it. The server cascades, so
 * one delete op covers the subtree — but the children's own queued ops have to go in the
 * same transaction, or a create for a child would be pushed after its parent is gone.
 *
 * `moveToId` names a category that stays: everything filed under the deleted one moves
 * there, here at once and server-side when the delete is pushed.
 */
export async function deleteCategory(
  id: string,
  moveToId: string | null = null,
): Promise<void> {
  await db.transaction('rw', [db.categories, ...refileTables()], async () => {
    const category = await db.categories.get(id)
    const target = moveToId ? await db.categories.get(moveToId) : undefined
    const source = category ? await filingOf(category) : null
    const destination = target ? await filingOf(target) : null
    if (source && destination) await refileLocally(source, destination)

    const neverSynced = (await pending(id).toArray()).some(
      (e) => e.op === 'create',
    )
    const children = await db.categories.where('parentId').equals(id).toArray()
    for (const child of children) {
      await pending(child.id).delete()
      await db.categories.delete(child.id)
    }
    await pending(id).delete()
    await db.categories.delete(id)
    if (!neverSynced) {
      const payload: DeleteCategoryWire | null =
        destination && moveToId ? { move_to: moveToId } : null
      await db.outbox.add({
        op: 'delete',
        entity: 'category',
        id,
        payload,
        baseVersion: null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}
