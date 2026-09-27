import { db } from '#/db/db'
import { pullDelta } from '#/db/delta'
import { requeued } from '#/db/syncFailure'
import type { OutboxEntry } from '#/db/types'
import { merchantsApi } from '#/features/merchants/api/merchantsApi'
import type {
  AliasDraftWire,
  CreateMerchantWire,
  Merchant,
  MerchantAlias,
  UpdateMerchantWire,
} from '#/features/merchants/api/types'
import {
  localRecurringToUpdateWire,
  localTransactionToUpdateWire,
} from '#/features/transactions/data/mappers'
import { ApiError } from '#/lib/apiError'
import { planAdoption } from './adopt'
import {
  localAliasToDraftWire,
  localMerchantToUpdateWire,
  serverAliasToLocal,
  serverMerchantToLocal,
} from './mappers'

/**
 * Push/pull handlers for merchants and their aliases. They follow the other features —
 * 409 rebases-and-retries once, 404 drops the local row, network errors bubble up — with
 * one addition nothing else needs: `adoptWinner`, below.
 */

const ALIAS_TAKEN = 'merchants.alias.taken'

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)
const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : '')
const now = () => new Date().toISOString()

type AliasCreatePayload = { merchantId: string; alias: AliasDraftWire }
type AliasDeletePayload = { merchantId: string }

const pending = (entity: 'merchant' | 'merchantAlias', id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

/**
 * Store server truth for one merchant. The server mints its own alias ids, so the local rows
 * that produced them are named explicitly in `dropAliasIds` rather than guessed at.
 */
async function storeMerchant(
  merchant: Merchant,
  dropAliasIds: string[] = [],
): Promise<void> {
  await db.merchants.put(serverMerchantToLocal(merchant))
  if (dropAliasIds.length > 0) await db.merchantAliases.bulkDelete(dropAliasIds)
  await db.merchantAliases.bulkPut(merchant.aliases.map(serverAliasToLocal))
}

// --- Merchants -----------------------------------------------------------------------

async function pushMerchantCreate(entry: OutboxEntry): Promise<void> {
  const localAliasIds = (
    await db.merchantAliases.where('merchantId').equals(entry.id).toArray()
  ).map((a) => a.id)
  try {
    const merchant = await merchantsApi.create(
      entry.payload as CreateMerchantWire,
    )
    await db.transaction(
      'rw',
      db.merchants,
      db.merchantAliases,
      db.outbox,
      async () => {
        await storeMerchant(merchant, localAliasIds)
        await db.outbox.delete(entry.seq)
      },
    )
  } catch (e) {
    if (statusOf(e) === 409 && codeOf(e) === ALIAS_TAKEN) {
      await adoptWinner(entry, e as ApiError)
      return
    }
    if (statusOf(e) === 409) {
      // The id is already taken (a second device pushed the same row) — adopt server truth.
      await db.outbox.delete(entry.seq)
      await pullMerchants()
      return
    }
    throw e
  }
}

async function pushMerchantUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const merchant = await merchantsApi.update(
      id,
      entry.payload as UpdateMerchantWire,
    )
    await db.transaction(
      'rw',
      db.merchants,
      db.merchantAliases,
      db.outbox,
      async () => {
        await storeMerchant(merchant)
        await db.outbox.delete(entry.seq)
      },
    )
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseMerchant(entry)
    if (status === 404) {
      await db.transaction(
        'rw',
        db.merchants,
        db.merchantAliases,
        db.outbox,
        async () => {
          await db.merchantAliases.where('merchantId').equals(id).delete()
          await db.merchants.delete(id)
          await db.outbox.delete(entry.seq)
        },
      )
      return
    }
    throw e
  }
}

async function rebaseMerchant(entry: OutboxEntry): Promise<void> {
  const fresh = (await merchantsApi.list()).find((m) => m.id === entry.id)
  const local = await db.merchants.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const merchant = await merchantsApi.update(
      entry.id,
      localMerchantToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction(
      'rw',
      db.merchants,
      db.merchantAliases,
      db.outbox,
      async () => {
        await storeMerchant(merchant)
        await db.outbox.delete(entry.seq)
      },
    )
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction(
      'rw',
      db.merchants,
      db.merchantAliases,
      db.outbox,
      async () => {
        await storeMerchant(fresh)
        await db.outbox.delete(entry.seq)
      },
    )
  }
}

async function pushMerchantDelete(entry: OutboxEntry): Promise<void> {
  try {
    await merchantsApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction(
    'rw',
    db.merchants,
    db.merchantAliases,
    db.outbox,
    async () => {
      await db.merchantAliases.where('merchantId').equals(entry.id).delete()
      await db.merchants.delete(entry.id)
      await db.outbox.delete(entry.seq)
    },
  )
}

// --- Aliases -------------------------------------------------------------------------

async function pushAliasCreate(entry: OutboxEntry): Promise<void> {
  const { merchantId, alias } = entry.payload as AliasCreatePayload
  try {
    const merchant = await merchantsApi.addAliases(merchantId, {
      aliases: [alias],
    })
    await db.transaction(
      'rw',
      db.merchants,
      db.merchantAliases,
      db.outbox,
      async () => {
        await storeMerchant(merchant, [entry.id])
        await db.outbox.delete(entry.seq)
      },
    )
  } catch (e) {
    const status = statusOf(e)
    // The key belongs to another merchant, or the merchant is gone: either way this
    // spelling cannot be filed here. Drop it and let a pull restore canonical state.
    if (status === 409 || status === 404) {
      await db.transaction('rw', db.merchantAliases, db.outbox, async () => {
        await db.merchantAliases.delete(entry.id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function pushAliasDelete(entry: OutboxEntry): Promise<void> {
  const { merchantId } = entry.payload as AliasDeletePayload
  try {
    await merchantsApi.removeAlias(merchantId, entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.merchantAliases, db.outbox, async () => {
    await db.merchantAliases.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Adopt and remap -----------------------------------------------------------------

/**
 * `409 merchants.alias.taken`: one of the identifiers we invented already belongs to another
 * merchant of this user, and **nothing was written** — our temp merchant does not exist
 * server-side, so it can never be patched or deleted remotely. The server names the winner in
 * `details[0]`; everything local that pointed at the temp id moves onto it.
 *
 * The subtle part is the outbox. A transaction still queued for its first push only needs its
 * queued payload rewritten; enqueueing an update for it would send a second round trip for a
 * row the server has not seen yet. Only rows already pushed get a real `PATCH`.
 */
async function adoptWinner(entry: OutboxEntry, error: ApiError): Promise<void> {
  const tempId = entry.id
  const winnerId = error.fieldValue('merchant_id')
  if (!winnerId) {
    // Without a winner there is nothing to adopt; drop the op rather than loop on it.
    await db.outbox.delete(entry.seq)
    return
  }

  const [tempAliases, transactions, recurrings, queued, knownAliases] =
    await Promise.all([
      db.merchantAliases.where('merchantId').equals(tempId).toArray(),
      db.transactions.where('merchantId').equals(tempId).toArray(),
      db.recurrings.filter((r) => r.merchantId === tempId).toArray(),
      db.outbox.toArray(),
      db.merchantAliases.toArray(),
    ])

  const plan = planAdoption({
    tempId,
    winnerId,
    transactions,
    recurrings,
    queued,
    tempAliases,
    knownAliases,
  })
  const byId = new Map(transactions.map((t) => [t.id, t]))
  const recurringById = new Map(recurrings.map((r) => [r.id, r]))

  await db.transaction(
    'rw',
    [
      db.merchants,
      db.merchantAliases,
      db.transactions,
      db.recurrings,
      db.outbox,
    ],
    async () => {
      await db.transactions
        .where('id')
        .anyOf(plan.repointTransactionIds)
        .modify({ merchantId: winnerId })
      await db.recurrings
        .where('id')
        .anyOf(plan.repointRecurringIds)
        .modify({ merchantId: winnerId })

      for (const rewrite of plan.rewrites) {
        const queuedEntry = await db.outbox.get(rewrite.seq)
        if (queuedEntry) {
          await db.outbox.put(
            requeued({ ...queuedEntry, payload: rewrite.payload }),
          )
        }
      }

      for (const id of plan.patchTransactionIds) {
        const tx = byId.get(id)
        if (!tx) continue
        await db.outbox.add({
          op: 'update',
          entity: 'transaction',
          id,
          payload: localTransactionToUpdateWire({
            ...tx,
            merchantId: winnerId,
          }),
          baseVersion: tx.version,
          createdAt: now(),
        })
      }

      for (const id of plan.patchRecurringIds) {
        const recurring = recurringById.get(id)
        if (!recurring) continue
        await db.outbox.add({
          op: 'update',
          entity: 'recurring',
          id,
          payload: localRecurringToUpdateWire({
            ...recurring,
            merchantId: winnerId,
          }),
          baseVersion: recurring.version,
          createdAt: now(),
        })
      }

      // The temp merchant never existed remotely: drop it and anything queued for it.
      await pending('merchant', tempId).delete()
      await db.merchants.delete(tempId)
      await db.merchantAliases.bulkDelete(
        plan.aliasesToDiscard.map((a) => a.id),
      )

      // Its spellings move to the winner and queue as ordinary alias adds — the endpoint is
      // idempotent, so re-sending one the winner already owns costs nothing.
      for (const alias of plan.aliasesToFold) {
        await pending('merchantAlias', alias.id).delete()
        await db.merchantAliases.put({ ...alias, merchantId: winnerId })
        await db.outbox.add({
          op: 'create',
          entity: 'merchantAlias',
          id: alias.id,
          payload: {
            merchantId: winnerId,
            alias: localAliasToDraftWire(alias),
          },
          baseVersion: null,
          createdAt: now(),
        })
      }
    },
  )

  // The winner may have been invented on another device, so make sure we hold it locally.
  if (!(await db.merchants.get(winnerId))) await pullMerchants()
}

// --- Pull ----------------------------------------------------------------------------

/**
 * Store one merchant from server truth. Local edits win until they've been pushed, and the
 * item carries the merchant's whole alias set, so a local alias it omits is one the server
 * no longer has.
 */
async function upsertMerchantFromServer(m: Merchant): Promise<void> {
  const local = await db.merchants.get(m.id)
  if (!local || (local.dirty === 0 && local.deleted === 0)) {
    await db.merchants.put(serverMerchantToLocal(m))
  }
  const serverAliasIds = new Set(m.aliases.map((a) => a.id))
  const locals = await db.merchantAliases
    .where('merchantId')
    .equals(m.id)
    .toArray()
  for (const l of locals) {
    if (l.dirty === 0 && !serverAliasIds.has(l.id)) {
      await db.merchantAliases.delete(l.id)
    }
  }
  await db.merchantAliases.bulkPut(m.aliases.map(serverAliasToLocal))
}

/**
 * Drop a merchant the server no longer has, with its aliases. A row holding an unpushed
 * edit stays: its own push settles it, and the 404 that earns is what finally removes it.
 */
async function dropMerchantLocally(id: string): Promise<void> {
  const local = await db.merchants.get(id)
  if (!local || local.dirty === 1) return
  await db.merchantAliases.where('merchantId').equals(id).delete()
  await db.merchants.delete(id)
}

export async function pullMerchants(): Promise<void> {
  const server = await merchantsApi.list()
  const ids = new Set(server.map((m) => m.id))
  await db.transaction('rw', db.merchants, db.merchantAliases, async () => {
    for (const m of server) await upsertMerchantFromServer(m)
    for (const l of await db.merchants.toArray()) {
      if (!ids.has(l.id)) await dropMerchantLocally(l.id)
    }
  })
}

/** One page of the merchant delta, under the full pull's rules restricted to its rows. */
async function applyMerchantChanges(
  items: ReadonlyArray<Merchant>,
  deletedIds: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.merchants, db.merchantAliases, async () => {
    for (const m of items) await upsertMerchantFromServer(m)
    for (const id of deletedIds) await dropMerchantLocally(id)
  })
}

async function applyAliasChanges(
  items: ReadonlyArray<MerchantAlias>,
  deletedIds: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.merchantAliases, async () => {
    for (const a of items) {
      const local = await db.merchantAliases.get(a.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.merchantAliases.put(serverAliasToLocal(a))
      }
    }
    for (const id of deletedIds) {
      const local = await db.merchantAliases.get(id)
      if (local && local.dirty === 0) await db.merchantAliases.delete(id)
    }
  })
}

const pullMerchantsDelta = (): Promise<void> =>
  pullDelta<Merchant>({
    entity: 'merchant',
    fetchChanges: merchantsApi.changes,
    apply: applyMerchantChanges,
    idOf: (m) => m.id,
    fullPull: pullMerchants,
    reconcile: async (delivered) => {
      await db.transaction('rw', db.merchants, db.merchantAliases, async () => {
        for (const l of await db.merchants.toArray()) {
          if (!delivered.has(l.id)) await dropMerchantLocally(l.id)
        }
      })
    },
  })

const pullMerchantAliasesDelta = (): Promise<void> =>
  pullDelta<MerchantAlias>({
    entity: 'merchantAlias',
    fetchChanges: merchantsApi.aliasChanges,
    apply: applyAliasChanges,
    idOf: (a) => a.id,
    // There is no standalone alias list; the full merchant list is where every alias lives.
    fullPull: pullMerchants,
    // No reconcile: on a first sync the merchant stream delivers every merchant with its
    // whole alias set, and that per-merchant reconciliation already covers the aliases.
  })

/**
 * Both merchant streams, in order. They are not run together: the merchant item restates a
 * whole alias set while the alias stream carries the tombstones, so applying the aliases
 * last is what keeps a deleted spelling from being written back by its merchant's page.
 */
export async function pullMerchantsAll(): Promise<void> {
  await pullMerchantsDelta()
  await pullMerchantAliasesDelta()
}

// --- Engine plug-in ------------------------------------------------------------------

/** Push one merchant/alias outbox entry. Throws on network/unexpected errors. */
export async function pushMerchantsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'merchantAlias') {
    if (entry.op === 'create') return pushAliasCreate(entry)
    return pushAliasDelete(entry)
  }
  if (entry.op === 'create') return pushMerchantCreate(entry)
  if (entry.op === 'update') return pushMerchantUpdate(entry)
  return pushMerchantDelete(entry)
}
