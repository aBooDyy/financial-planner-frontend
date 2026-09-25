import { db } from '#/db/db'
import { clearWatermark } from '#/db/watermarks'
import type { OutboxEntry } from '#/db/types'
import { categoriesApi } from '#/features/categories/api/categoriesApi'
import type {
  CreateCategoryWire,
  DeleteCategoryWire,
  UpdateCategoryWire,
} from '#/features/categories/api/types'
import { ApiError } from '#/lib/apiError'
import { localCategoryToUpdateWire, serverCategoryToLocal } from './mappers'

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
    if (statusOf(e) === 409) {
      // Id or slug already taken server-side — adopt the server set.
      await db.outbox.delete(entry.seq)
      await pullCategories()
      return
    }
    throw e
  }
}

async function pushCategoryUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const c = await categoriesApi.update(
      id,
      entry.payload as UpdateCategoryWire,
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
    const c = await categoriesApi.update(
      entry.id,
      localCategoryToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.categories, db.outbox, async () => {
      await db.categories.put(serverCategoryToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch {
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
    if (status === 0) throw e
    // The server re-filed nothing, but this device already did: forget the ledger's
    // watermarks so the next pull restores what the server actually holds.
    if (moveTo) await forgetRefiledWatermarks()
    if (status !== 404) throw e
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

async function forgetRefiledWatermarks(): Promise<void> {
  await clearWatermark('transaction')
  await clearWatermark('planned')
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
