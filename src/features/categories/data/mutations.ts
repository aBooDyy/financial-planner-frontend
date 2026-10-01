import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import type { LocalCategory } from '#/db/types'
import type {
  DeleteCategoryWire,
  SpendClass,
} from '#/features/categories/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { localCategoryToCreateWire, localCategoryToUpdateWire } from './mappers'
import {
  isInUse,
  refileLocally,
  refileTables,
  subtreeIds,
  unlinkLocally,
} from './refile'
import { isRequiredCategory } from './required'
import { uniqueSlug } from './slug'

const now = () => new Date().toISOString()
export type CategoryDraft = {
  name: string
  type: TxType
  color: string
  /** `null`/omitted creates a top-level category; an id creates a child of that category. */
  parentId?: string | null
  icon?: string | null
  /** Spend categories only; ignored (stored as null) for income. */
  spendClass?: SpendClass | null
}

export type CategoryPatch = Partial<{
  name: string
  color: string
  /** `null` clears the icon back to the default for the row's type. */
  icon: string | null
  position: number
  /** `null` moves it to the top level; see `moveRules` for where it may go. */
  parentId: string | null
  /** `null` inherits the root's (a subcategory) or leaves it unsorted (a root). */
  spendClass: SpendClass | null
}>

const liveCategories = async (): Promise<LocalCategory[]> =>
  (await db.categories.toArray()).filter((c) => c.deleted === 0)

const siblingsOf = async (parentId: string | null): Promise<LocalCategory[]> =>
  (await liveCategories()).filter((c) => c.parentId === parentId)

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
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  const payload = localCategoryToUpdateWire(category)
  if (update) {
    update.payload = payload
    update.baseVersion = category.version
    await db.outbox.put(requeued(update))
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
  const taken = (await siblingsOf(parentId)).map((c) => c.slug)
  return createCategoryWithSlug(uniqueSlug(draft.name, taken), draft)
}

/**
 * Create a category under a caller-supplied slug (the importer picks one while mapping). When a
 * sibling of the same type already owns the slug nothing is created and the sibling's id comes
 * back instead; one of the other type keeps it, and the new category takes the next free slug.
 */
export async function createCategoryWithSlug(
  requested: string,
  draft: CategoryDraft,
): Promise<string> {
  const parentId = draft.parentId ?? null
  // A child's type is its parent's, and a blank colour means "the parent's" — both are what
  // the server decides on create, so the local row has to agree or the next pull flips it.
  const parent = parentId ? await db.categories.get(parentId) : undefined
  if (parentId && (!parent || parent.deleted !== 0)) {
    throw new Error(`category parent ${parentId} is gone`)
  }
  const type = parent?.type ?? draft.type
  const siblings = await siblingsOf(parentId)
  const owner = siblings.find((c) => c.slug === requested)
  if (owner && owner.type === type) return owner.id
  const slug = owner
    ? uniqueSlug(
        requested,
        siblings.map((c) => c.slug),
      )
    : requested

  const id = newId()
  const ts = now()
  const category: LocalCategory = {
    id,
    parentId,
    slug,
    name: draft.name.trim(),
    type,
    color: draft.color.trim() || (parent?.color ?? draft.color),
    icon: draft.icon ?? null,
    spendClass: type === 'spend' ? (draft.spendClass ?? null) : null,
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
  const parentId =
    patch.parentId !== undefined ? patch.parentId : existing.parentId
  const moved = parentId !== existing.parentId
  const category: LocalCategory = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    color: patch.color ?? existing.color,
    icon: patch.icon !== undefined ? patch.icon : existing.icon,
    spendClass:
      existing.type !== 'spend'
        ? null
        : patch.spendClass !== undefined
          ? patch.spendClass
          : (existing.spendClass ?? null),
    parentId,
    position:
      patch.position ??
      (moved ? await nextPosition(parentId) : existing.position),
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.put(category)
    await enqueueCategoryUpsert(category)
  })
  schedulePush()
}

/** Tag a spend category as a need, want or saving (`null` clears it). */
export async function setCategorySpendClass(
  id: string,
  spendClass: SpendClass | null,
): Promise<void> {
  await updateCategory(id, { spendClass })
}

/** The local mirror of the server's delete refusals; `code` is the server's. */
export class CategoryDeleteRefused extends Error {
  readonly code: string
  constructor(reason: 'required' | 'in_use') {
    super(`Category delete refused: ${reason}`)
    this.code = `settings.category.${reason}`
  }
}

/**
 * Delete a category and, when it is a parent, its children with it. The server cascades, so
 * one delete op covers the subtree — but the children's own queued ops have to go in the
 * same transaction, or a create for a child would be pushed after its parent is gone.
 *
 * When anything is filed under the subtree, `moveToId` must name a surviving category of the
 * same type: everything filed there moves to it, here at once and server-side when the delete
 * is pushed. The required roots are never deleted.
 */
export async function deleteCategory(
  id: string,
  moveToId: string | null = null,
): Promise<void> {
  await db.transaction('rw', refileTables(), async () => {
    const category = await db.categories.get(id)
    if (!category) return
    if (isRequiredCategory(category))
      throw new CategoryDeleteRefused('required')

    const subtree = await subtreeIds(id)
    const target = await moveTargetOf(subtree, category, moveToId)
    if (target) {
      await refileLocally(subtree, target.id, target.parentId ?? target.id)
    } else if (await isInUse(subtree)) {
      throw new CategoryDeleteRefused('in_use')
    } else {
      await unlinkLocally(subtree)
    }

    const neverSynced = (await pending(id).toArray()).some(
      (e) => e.op === 'create',
    )
    for (const childId of subtree) {
      if (childId === id) continue
      await pending(childId).delete()
      await db.categories.delete(childId)
    }
    await pending(id).delete()
    await db.categories.delete(id)
    if (!neverSynced) {
      const payload: DeleteCategoryWire | null = target
        ? { move_to: target.id }
        : null
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

async function moveTargetOf(
  subtree: ReadonlySet<string>,
  deleting: LocalCategory,
  moveToId: string | null,
): Promise<LocalCategory | null> {
  if (!moveToId || subtree.has(moveToId)) return null
  const target = await db.categories.get(moveToId)
  if (!target || target.deleted === 1 || target.type !== deleting.type)
    return null
  return target
}
