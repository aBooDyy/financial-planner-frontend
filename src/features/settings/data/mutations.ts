import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import type { LocalCustomCurrency, LocalExchangeRate } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type { UpdateRateWire } from '#/features/settings/api/types'
import {
  localCustomCurrencyToCreateWire,
  localCustomCurrencyToUpdateWire,
} from './mappers'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

const pending = (entity: 'customCurrency' | 'rate', id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

// --- Custom currencies ---------------------------------------------------------------

export type CustomCurrencyDraft = {
  code: string
  name: string
  symbol: string
  minorUnit: number
}

export type CustomCurrencyPatch = Partial<{
  name: string
  symbol: string
  rate: number
}>

async function enqueueCustomCurrencyUpsert(
  currency: LocalCustomCurrency,
): Promise<void> {
  const entries = await pending('customCurrency', currency.id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    create.payload = localCustomCurrencyToCreateWire(currency)
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  const payload = localCustomCurrencyToUpdateWire(currency)
  if (update) {
    update.payload = payload
    update.baseVersion = currency.version
    await db.outbox.put(requeued(update))
    return
  }
  await db.outbox.add({
    op: 'update',
    entity: 'customCurrency',
    id: currency.id,
    payload,
    baseVersion: currency.version,
    createdAt: now(),
  })
}

/** Create one of the user's own currencies. `rate` is absolute (units of the reference per
 *  1 unit), which is what every other rate in the app means. */
export async function createCustomCurrency(
  draft: CustomCurrencyDraft,
  rate: number,
): Promise<string> {
  const id = newId()
  const ts = now()
  const currency: LocalCustomCurrency = {
    id,
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    symbol: draft.symbol.trim(),
    minorUnit: draft.minorUnit,
    rate,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
    await db.customCurrencies.put(currency)
    await db.outbox.add({
      op: 'create',
      entity: 'customCurrency',
      id,
      payload: localCustomCurrencyToCreateWire(currency),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateCustomCurrency(
  id: string,
  patch: CustomCurrencyPatch,
): Promise<void> {
  const existing = await db.customCurrencies.get(id)
  if (!existing) return
  const currency: LocalCustomCurrency = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    symbol: patch.symbol !== undefined ? patch.symbol.trim() : existing.symbol,
    rate: patch.rate ?? existing.rate,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
    await db.customCurrencies.put(currency)
    await enqueueCustomCurrencyUpsert(currency)
  })
  schedulePush()
}

export async function deleteCustomCurrency(id: string): Promise<void> {
  const entries = await pending('customCurrency', id).toArray()
  const neverSynced = entries.some((e) => e.op === 'create')
  await db.transaction('rw', db.customCurrencies, db.outbox, async () => {
    await pending('customCurrency', id).delete()
    await db.customCurrencies.delete(id)
    if (!neverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity: 'customCurrency',
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

/**
 * Set the user's FX rate for one currency. Copy-on-write in both directions: the defaults
 * live in the app config, so the first edit of a currency *creates* its row — locally and
 * (with no `version` to check) on the server. The edit stays local-dirty until the sync
 * engine pushes it, so a background pull won't clobber it.
 */
export async function setExchangeRate(
  currency: CurrencyCode,
  rate: number,
): Promise<void> {
  const existing = await db.exchangeRates.get(currency)
  const next: LocalExchangeRate = {
    currency,
    version: existing?.version ?? '',
    ...existing,
    rate,
    updatedAt: now(),
    dirty: 1,
  }
  const payload: UpdateRateWire = existing?.version
    ? { version: existing.version, rate: String(rate) }
    : { rate: String(rate) }
  await db.transaction('rw', db.exchangeRates, db.outbox, async () => {
    await db.exchangeRates.put(next)
    const open = await pending('rate', currency).first()
    if (open) {
      open.payload = payload
      await db.outbox.put(requeued(open))
    } else {
      await db.outbox.add({
        op: 'update',
        entity: 'rate',
        id: currency,
        payload,
        baseVersion: existing?.version ?? null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}
