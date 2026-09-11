import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import { balancesApi } from '#/features/balances/api/balancesApi'
import { categoriesApi } from '#/features/settings/api/categoriesApi'
import type {
  CreateCategoryWire,
  UpdateCategoryWire,
  UpdateRateWire,
} from '#/features/settings/api/types'
import { ApiError } from '#/lib/apiError'
import type { CurrencyCode } from '#/lib/currency'
import { localCategoryToUpdateWire, serverCategoryToLocal } from './mappers'

/**
 * Push/pull handlers for the Settings entities (user-editable categories and per-user
 * exchange rates), plugged into the shared sync engine. They mirror the other features:
 * 409 rebases-and-retries once, 404 drops the local row, network errors bubble up.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Categories ----------------------------------------------------------------------

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
  try {
    await categoriesApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

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

// --- Exchange rates ------------------------------------------------------------------

async function pushRateUpdate(entry: OutboxEntry): Promise<void> {
  const currency = entry.id
  try {
    const rate = await balancesApi.updateRate(
      currency,
      entry.payload as UpdateRateWire,
    )
    await db.exchangeRates.put({
      currency: rate.currency,
      rate: rate.rate,
      version: rate.version,
      updatedAt: rate.updatedAt,
      dirty: 0,
    })
    await db.outbox.delete(entry.seq)
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseRate(entry)
    throw e
  }
}

async function rebaseRate(entry: OutboxEntry): Promise<void> {
  const currency = entry.id as CurrencyCode
  const fresh = (await balancesApi.listRates()).find(
    (r) => r.currency === currency,
  )
  const local = await db.exchangeRates.get(currency)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const rate = await balancesApi.updateRate(currency, {
      version: fresh.version,
      rate: String(local.rate),
    })
    await db.exchangeRates.put({
      currency: rate.currency,
      rate: rate.rate,
      version: rate.version,
      updatedAt: rate.updatedAt,
      dirty: 0,
    })
    await db.outbox.delete(entry.seq)
  } catch {
    await db.exchangeRates.put({
      currency: fresh.currency,
      rate: fresh.rate,
      version: fresh.version,
      updatedAt: fresh.updatedAt,
      dirty: 0,
    })
    await db.outbox.delete(entry.seq)
  }
}

// --- Engine plug-ins -----------------------------------------------------------------

/** Push one category/rate outbox entry. Throws on network/unexpected errors. */
export async function pushSettingsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'category') {
    if (entry.op === 'create') return pushCategoryCreate(entry)
    if (entry.op === 'update') return pushCategoryUpdate(entry)
    return pushCategoryDelete(entry)
  }
  // rate — only ever an update.
  return pushRateUpdate(entry)
}
