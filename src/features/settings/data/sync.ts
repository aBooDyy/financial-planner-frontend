import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import { balancesApi } from '#/features/balances/api/balancesApi'
import { customCurrenciesApi } from '#/features/settings/api/customCurrenciesApi'
import type {
  CreateCustomCurrencyWire,
  UpdateCustomCurrencyWire,
  UpdateRateWire,
} from '#/features/settings/api/types'
import { ApiError } from '#/lib/apiError'
import {
  localCustomCurrencyToUpdateWire,
  serverCustomCurrencyToLocal,
} from './mappers'

/**
 * Push/pull handlers for the Settings entities (the user's own currencies and per-user
 * exchange rates), plugged into the shared sync engine. They mirror the other features: 409
 * rebases-and-retries once, 404 drops the local row, network errors bubble up.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Custom currencies ---------------------------------------------------------------

async function pushCustomCurrencyCreate(entry: OutboxEntry): Promise<void> {
  try {
    const c = await customCurrenciesApi.create(
      entry.payload as CreateCustomCurrencyWire,
    )
    await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
      await db.customCurrencies.put(serverCustomCurrencyToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      // Id or code already taken server-side — adopt the server set.
      await db.outbox.delete(entry.seq)
      await pullCustomCurrencies()
      return
    }
    throw e
  }
}

async function pushCustomCurrencyUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const c = await customCurrenciesApi.update(
      id,
      entry.payload as UpdateCustomCurrencyWire,
    )
    await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
      await db.customCurrencies.put(serverCustomCurrencyToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseCustomCurrency(entry)
    if (status === 404) {
      await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
        await db.customCurrencies.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseCustomCurrency(entry: OutboxEntry): Promise<void> {
  const fresh = (await customCurrenciesApi.list()).find(
    (c) => c.id === entry.id,
  )
  const local = await db.customCurrencies.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const c = await customCurrenciesApi.update(
      entry.id,
      localCustomCurrencyToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
      await db.customCurrencies.put(serverCustomCurrencyToLocal(c))
      await db.outbox.delete(entry.seq)
    })
  } catch {
    await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
      await db.customCurrencies.put(serverCustomCurrencyToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushCustomCurrencyDelete(entry: OutboxEntry): Promise<void> {
  try {
    await customCurrenciesApi.remove(entry.id)
  } catch (e) {
    const status = statusOf(e)
    // A 409 means something still holds money in it — the server keeps the currency, so the
    // local copy comes back rather than leaving those amounts with no currency behind them.
    if (status === 409) {
      await db.outbox.delete(entry.seq)
      await pullCustomCurrencies()
      return
    }
    if (status !== 404) throw e
  }
  await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
    await db.customCurrencies.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

export async function pullCustomCurrencies(): Promise<void> {
  const server = await customCurrenciesApi.list()
  const ids = new Set(server.map((c) => c.id))
  await db.transaction('rw', db.customCurrencies, async () => {
    for (const c of server) {
      const local = await db.customCurrencies.get(c.id)
      // Local edits win until they've been pushed.
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.customCurrencies.put(serverCustomCurrencyToLocal(c))
      }
    }
    for (const l of await db.customCurrencies.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) {
        await db.customCurrencies.delete(l.id)
      }
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
  const currency = entry.id
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

/** Push one currency/rate outbox entry. Throws on network/unexpected errors. */
export async function pushSettingsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'customCurrency') {
    if (entry.op === 'create') return pushCustomCurrencyCreate(entry)
    if (entry.op === 'update') return pushCustomCurrencyUpdate(entry)
    return pushCustomCurrencyDelete(entry)
  }
  // rate — only ever an update.
  return pushRateUpdate(entry)
}
