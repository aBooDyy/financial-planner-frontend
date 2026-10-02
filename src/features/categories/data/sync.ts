import { db } from '#/db/db'
import { isUnavailableStatus } from '#/db/syncFailure'
import { clearWatermark } from '#/db/watermarks'
import type { LocalCategory, OutboxEntry } from '#/db/types'
import { categoriesApi } from '#/features/categories/api/categoriesApi'
import type {
  CreateCategoryWire,
  DeleteCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'
import { remapTemplateCategories } from '#/features/import/data/mutations'
import { ApiError } from '#/lib/apiError'
import { toWireSpendClass } from '#/features/categories/api/types'
import { localCategoryToUpdateWire, serverCategoryToLocal } from './mappers'
import type { QueuedCategoryUpdate } from './mappers'
import { refileTables, remapLocally } from './refile'
import { uniqueSlug } from './slug'

/**
 * Push/pull handlers for the category tree, plugged into the shared sync engine. They
 * mirror the other features: 409 rebases-and-retries once, 404 drops the local row, network
 * errors bubble up.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

async function pushCategoryCreate(entry: OutboxEntry): Promise<void> {
  try {
    const c = await categoriesApi.create(entry.payload as CreateCategoryWire)
    await db.transaction('rw', db.categories, db.outbox, async () => {
      await db.categories.put(serverCategoryToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) return adoptServerCategory(entry)
    throw e
  }
}

/**
 * The id or the slug is already taken server-side. An id clash is a retried create the server
 * already holds. A slug clash means another device created the same category first: the
 * server's row wins, and everything this device filed under its own id moves onto it. A root
 * slug is unique across both types, so a clash with a root of the other type is not the same
 * category: this one takes the next free slug and its create goes out again.
 */
async function adoptServerCategory(entry: OutboxEntry): Promise<void> {
  const server = await categoriesApi.list()
  const local = await db.categories.get(entry.id)
  const same = server.find((c) => c.id === entry.id)
  const clash =
    local && !same
      ? server.find(
          (c) => c.parentId === local.parentId && c.slug === local.slug,
        )
      : undefined
  if (local && clash && clash.type !== local.type) {
    const onDevice = await db.categories.toArray()
    return reslugCreate(
      entry,
      local,
      [...server, ...onDevice].filter((c) => c.parentId === local.parentId),
    )
  }
  const twin = clash
  await db.transaction('rw', refileTables(), async () => {
    await db.outbox.delete(entry.seq)
    const adopted = same ?? twin
    if (adopted) await db.categories.put(serverCategoryToLocal(adopted))
    if (twin) {
      await remapLocally(entry.id, twin.id)
      await db.categories.delete(entry.id)
    }
  })
  if (twin) await remapTemplateCategories(entry.id, twin.id)
  await pullCategories()
}

async function reslugCreate(
  entry: OutboxEntry,
  local: LocalCategory,
  siblings: ReadonlyArray<{ slug: string }>,
): Promise<void> {
  const slug = uniqueSlug(
    local.slug,
    siblings.map((c) => c.slug),
  )
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.put({ ...local, slug })
    await db.outbox.put({
      ...entry,
      payload: { ...(entry.payload as CreateCategoryWire), slug },
    })
  })
}

/**
 * The PATCH replaces `spend_class`, so an update queued without one (the class was never known
 * here) carries the server's — sending null would wipe the tag the server seeded.
 */
async function withSpendClass(
  id: string,
  body: QueuedCategoryUpdate,
): Promise<UpdateCategoryWire> {
  if (body.spend_class !== undefined)
    return { ...body, spend_class: body.spend_class }
  const server = (await categoriesApi.list()).find((c) => c.id === id)
  return { ...body, spend_class: toWireSpendClass(server?.spendClass) }
}

async function pushCategoryUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const c = await categoriesApi.update(
      id,
      await withSpendClass(id, entry.payload as QueuedCategoryUpdate),
    )
    await db.transaction('rw', db.categories, db.outbox, async () => {
      await db.categories.put(serverCategoryToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseCategory(entry)
    if (status === 404) {
      await db.transaction('rw', db.categories, db.outbox, async () => {
        await db.categories.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseCategory(entry: OutboxEntry): Promise<void> {
  const fresh = (await categoriesApi.list()).find((c) => c.id === entry.id)
  const local = await db.categories.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const spendClass =
      local.spendClass === undefined ? fresh.spendClass : local.spendClass
    const c = await categoriesApi.update(entry.id, {
      ...localCategoryToUpdateWire({ ...local, version: fresh.version }),
      spend_class: toWireSpendClass(spendClass),
    })
    await db.transaction('rw', db.categories, db.outbox, async () => {
      await db.categories.put(serverCategoryToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.categories, db.outbox, async () => {
      await db.categories.put(serverCategoryToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushCategoryDelete(entry: OutboxEntry): Promise<void> {
  const moveTo = (entry.payload as DeleteCategoryWire | null)?.move_to ?? null
  try {
    await categoriesApi.remove(entry.id, moveTo)
  } catch (e) {
    const status = statusOf(e)
    if (isUnavailableStatus(status)) throw e
    // This device already moved or unlinked what was filed under the category, whatever the
    // server did: forget the delta watermarks so the next pull restores what it holds.
    await forgetRewrittenWatermarks()
    if (status === 409) {
      // In use, or one the user cannot delete: the server keeps it, and so does this device.
      await db.outbox.delete(entry.seq)
      await pullCategories()
      return
    }
    if (status !== 404) throw e
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

async function forgetRewrittenWatermarks(): Promise<void> {
  await clearWatermark('transaction')
  await clearWatermark('planned')
  await clearWatermark('merchant')
}

/** Push one category outbox entry. Throws on network/unexpected errors. */
export async function pushCategoryEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushCategoryCreate(entry)
  if (entry.op === 'update') return pushCategoryUpdate(entry)
  return pushCategoryDelete(entry)
}

/** A full list read — a category set is bounded at dozens of rows, so no delta window. */
export async function pullCategories(): Promise<void> {
  const server = await categoriesApi.list()
  const ids = new Set(server.map((c) => c.id))
  await db.transaction('rw', db.categories, async () => {
    for (const c of server) {
      const local = await db.categories.get(c.id)
      // Local edits win until they've been pushed.
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.categories.put(serverCategoryToLocal(c))
      }
    }
    for (const l of await db.categories.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.categories.delete(l.id)
    }
  })
}
