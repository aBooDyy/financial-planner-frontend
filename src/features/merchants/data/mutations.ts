import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import { merchantsApi } from '#/features/merchants/api/merchantsApi'
import type { AliasOrigin } from '#/features/merchants/api/types'
import {
  pullRecurrings,
  pullTransactions,
} from '#/features/transactions/data/sync'
import type { TxType } from '#/features/transactions/api/types'
import { ApiError } from '#/lib/apiError'
import {
  localAliasToDraftWire,
  localMerchantToCreateWire,
  localMerchantToUpdateWire,
} from './mappers'
import { identityKey, MAX_ALIAS_LENGTH } from './matching'
import { pullMerchants } from './sync'

const now = () => new Date().toISOString()
export type AliasDraft = { raw: string; origin?: AliasOrigin }

export type MerchantDraft = {
  displayName: string
  /** Extra spellings beyond the display name itself. */
  aliases?: AliasDraft[]
  learnedCategoryId?: string | null
  learnedType?: TxType | null
  autoCategorize?: boolean
}

export type MerchantPatch = Partial<{
  displayName: string
  learnedCategoryId: string | null
  learnedType: TxType | null
  autoCategorize: boolean
}>

/** True when a spelling survives normalisation — an Arabic-only name does not. */
export const isUsableAlias = (raw: string): boolean =>
  identityKey(raw).length > 0 && raw.trim().length <= MAX_ALIAS_LENGTH

// The server would answer this exact code; raising it locally keeps one error channel for
// the UI, and spares a round trip for a name we already know it will refuse.
const aliasInvalid = () =>
  new ApiError({
    code: 'merchants.alias.invalid',
    message: 'That name has no letters or digits we can recognise.',
    status: 422,
  })

const pending = (entity: 'merchant' | 'merchantAlias', id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

const buildAlias = (
  merchantId: string,
  draft: AliasDraft,
  ts: string,
): LocalMerchantAlias => ({
  id: newId(),
  merchantId,
  normalizedKey: identityKey(draft.raw),
  rawSample: draft.raw.trim().slice(0, MAX_ALIAS_LENGTH) || null,
  origin: draft.origin ?? 'manual',
  createdAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

/** Dedupe by identity key, dropping spellings that normalise to nothing. */
const usableAliases = (
  merchantId: string,
  drafts: AliasDraft[],
  ts: string,
): LocalMerchantAlias[] => {
  const seen = new Set<string>()
  const rows: LocalMerchantAlias[] = []
  for (const draft of drafts) {
    const alias = buildAlias(merchantId, draft, ts)
    if (!alias.normalizedKey || seen.has(alias.normalizedKey)) continue
    seen.add(alias.normalizedKey)
    rows.push(alias)
  }
  return rows
}

/** Refresh the queued create payload so it carries the merchant's current alias set. */
async function refreshQueuedCreate(merchantId: string): Promise<boolean> {
  const create = await pending('merchant', merchantId)
    .filter((e) => e.op === 'create')
    .first()
  if (!create) return false
  const merchant = await db.merchants.get(merchantId)
  if (!merchant) return false
  const aliases = await db.merchantAliases
    .where('merchantId')
    .equals(merchantId)
    .toArray()
  create.payload = localMerchantToCreateWire(
    merchant,
    aliases.filter((a) => a.deleted === 0),
  )
  await db.outbox.put(requeued(create))
  return true
}

/** Returns the row it wrote, so a caller can use the merchant before the next live query. */
export async function createMerchant(
  draft: MerchantDraft,
): Promise<LocalMerchant> {
  return createMerchantWithId(newId(), draft)
}

/**
 * Create a merchant under a caller-supplied id. The importer binds rows to merchants it has
 * not written yet, so the id has to be final before the commit; idempotent, so a retried
 * commit adds nothing twice.
 */
export async function createMerchantWithId(
  id: string,
  draft: MerchantDraft,
): Promise<LocalMerchant> {
  const existing = await db.merchants.get(id)
  if (existing) return existing
  const ts = now()
  const aliases = usableAliases(
    id,
    [{ raw: draft.displayName }, ...(draft.aliases ?? [])],
    ts,
  )
  if (aliases.length === 0) throw aliasInvalid()

  const merchant: LocalMerchant = {
    id,
    displayName: draft.displayName.trim(),
    learnedCategoryId: draft.learnedCategoryId ?? null,
    learnedType: draft.learnedType ?? null,
    timesSeen: 0,
    timesConfirmed: 0,
    lastSeenAt: null,
    autoCategorize: draft.autoCategorize ?? false,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }

  await db.transaction(
    'rw',
    db.merchants,
    db.merchantAliases,
    db.outbox,
    async () => {
      await db.merchants.put(merchant)
      await db.merchantAliases.bulkPut(aliases)
      await db.outbox.add({
        op: 'create',
        entity: 'merchant',
        id,
        payload: localMerchantToCreateWire(merchant, aliases),
        baseVersion: null,
        createdAt: ts,
      })
    },
  )
  schedulePush()
  return merchant
}

export async function updateMerchant(
  id: string,
  patch: MerchantPatch,
): Promise<void> {
  const existing = await db.merchants.get(id)
  if (!existing) return
  const displayName =
    patch.displayName !== undefined
      ? patch.displayName.trim()
      : existing.displayName
  if (!displayName) throw aliasInvalid()

  const merchant: LocalMerchant = {
    ...existing,
    displayName,
    learnedCategoryId:
      patch.learnedCategoryId !== undefined
        ? patch.learnedCategoryId
        : existing.learnedCategoryId,
    learnedType:
      patch.learnedType !== undefined
        ? patch.learnedType
        : existing.learnedType,
    autoCategorize: patch.autoCategorize ?? existing.autoCategorize,
    updatedAt: now(),
    dirty: 1,
  }

  await db.transaction(
    'rw',
    db.merchants,
    db.merchantAliases,
    db.outbox,
    async () => {
      await db.merchants.put(merchant)
      if (await refreshQueuedCreate(id)) return
      const update = await pending('merchant', id)
        .filter((e) => e.op === 'update')
        .first()
      const payload = localMerchantToUpdateWire(merchant)
      if (update) {
        update.payload = payload
        update.baseVersion = merchant.version
        await db.outbox.put(requeued(update))
        return
      }
      await db.outbox.add({
        op: 'update',
        entity: 'merchant',
        id,
        payload,
        baseVersion: merchant.version,
        createdAt: now(),
      })
    },
  )
  schedulePush()
}

export async function deleteMerchant(id: string): Promise<void> {
  const entries = await pending('merchant', id).toArray()
  const neverSynced = entries.some((e) => e.op === 'create')
  const aliases = await db.merchantAliases
    .where('merchantId')
    .equals(id)
    .toArray()

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
      await pending('merchant', id).delete()
      for (const alias of aliases)
        await pending('merchantAlias', alias.id).delete()
      await db.merchantAliases.bulkDelete(aliases.map((a) => a.id))
      await db.merchants.delete(id)
      // The FK is ON DELETE SET NULL server-side; mirror that locally so no row points at
      // a merchant that is gone.
      await db.transactions
        .where('merchantId')
        .equals(id)
        .modify({ merchantId: null })
      await db.recurrings
        .filter((r) => r.merchantId === id)
        .modify({ merchantId: null })
      if (!neverSynced) {
        await db.outbox.add({
          op: 'delete',
          entity: 'merchant',
          id,
          payload: null,
          baseVersion: null,
          createdAt: now(),
        })
      }
    },
  )
  schedulePush()
}

// --- Aliases -------------------------------------------------------------------------

export async function addMerchantAlias(
  merchantId: string,
  raw: string,
  origin: AliasOrigin = 'manual',
): Promise<void> {
  const ts = now()
  const alias = buildAlias(merchantId, { raw, origin }, ts)
  if (!alias.normalizedKey) throw aliasInvalid()

  const owner = await db.merchantAliases
    .where('normalizedKey')
    .equals(alias.normalizedKey)
    .first()
  if (owner && owner.deleted === 0) return // already an identifier for someone

  await db.transaction(
    'rw',
    db.merchants,
    db.merchantAliases,
    db.outbox,
    async () => {
      await db.merchantAliases.put(alias)
      // A merchant whose create is still queued carries its aliases in that payload.
      if (await refreshQueuedCreate(merchantId)) return
      await db.outbox.add({
        op: 'create',
        entity: 'merchantAlias',
        id: alias.id,
        payload: { merchantId, alias: localAliasToDraftWire(alias) },
        baseVersion: null,
        createdAt: ts,
      })
    },
  )
  schedulePush()
}

export async function removeMerchantAlias(aliasId: string): Promise<void> {
  const alias = await db.merchantAliases.get(aliasId)
  if (!alias) return
  const remaining = await db.merchantAliases
    .where('merchantId')
    .equals(alias.merchantId)
    .filter((a) => a.deleted === 0 && a.id !== aliasId)
    .count()
  // A merchant with no identifiers can never be matched again.
  if (remaining === 0) return

  await db.transaction(
    'rw',
    db.merchants,
    db.merchantAliases,
    db.outbox,
    async () => {
      await pending('merchantAlias', aliasId).delete()
      await db.merchantAliases.delete(aliasId)
      if (await refreshQueuedCreate(alias.merchantId)) return
      // Only a server-issued alias can be deleted remotely; the server mints its own ids,
      // so a row that has never synced simply disappears.
      if (!alias.version) return
      await db.outbox.add({
        op: 'delete',
        entity: 'merchantAlias',
        id: aliasId,
        payload: { merchantId: alias.merchantId },
        baseVersion: null,
        createdAt: now(),
      })
    },
  )
  schedulePush()
}

// --- Merge ---------------------------------------------------------------------------

/**
 * Fold one merchant into another. Deliberately **not** queued through the outbox: the server
 * repoints transactions, schedules and email imports in one transaction and bumps every version it
 * touches, so the client pulls the result rather than guessing at it. Requires a connection.
 */
export async function mergeMerchants(
  sourceId: string,
  targetId: string,
): Promise<void> {
  if (sourceId === targetId) return
  const source = await db.merchants.get(sourceId)
  if (!source) return
  await merchantsApi.merge({
    source_id: sourceId,
    target_id: targetId,
    version: source.version,
  })
  await Promise.all([pullMerchants(), pullTransactions(), pullRecurrings()])
}
