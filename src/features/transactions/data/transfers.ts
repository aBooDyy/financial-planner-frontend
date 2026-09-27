import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import type { LocalTransaction, OutboxEntry } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type { TransferLegType } from '#/features/transactions/api/types'
import { transferToCreateWire, transferToUpdateWire } from './mappers'
import type { HeldLegs, TransferLegs } from './mappers'

export type TransferDraft = {
  fromWalletId: string
  toWalletId: string
  /** Minor units in the source wallet's currency. */
  amount: number
  fromCurrency: CurrencyCode
  /** Minor units in the destination wallet's currency — equal to `amount` within one currency. */
  toAmount: number
  toCurrency: CurrencyCode
  date: string
  note: string | null
}

const now = () => new Date().toISOString()
const pendingFor = (transferId: string) =>
  db.outbox.where('[entity+id]').equals(['transfer', transferId])

export async function heldLegs(transferId: string): Promise<HeldLegs> {
  const rows = await db.transactions
    .where('transferId')
    .equals(transferId)
    .toArray()
  return {
    out: rows.find((r) => r.type === 'transfer_out'),
    in: rows.find((r) => r.type === 'transfer_in'),
  }
}

const bothLegs = (legs: HeldLegs): legs is TransferLegs =>
  legs.out !== undefined && legs.in !== undefined

const buildLeg = (
  id: string,
  transferId: string,
  type: TransferLegType,
  walletId: string,
  amount: number,
  currency: CurrencyCode,
  draft: TransferDraft,
  ts: string,
  source: string | null,
): LocalTransaction => ({
  id,
  type,
  amount,
  currency,
  categoryId: null,
  walletId,
  goalId: null,
  merchantId: null,
  date: draft.date,
  note: draft.note,
  source,
  transferId,
  plannedId: null,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

const legsFor = (
  transferId: string,
  outId: string,
  inId: string,
  draft: TransferDraft,
  ts: string,
  source: string | null = null,
): TransferLegs => ({
  out: buildLeg(
    outId,
    transferId,
    'transfer_out',
    draft.fromWalletId,
    draft.amount,
    draft.fromCurrency,
    draft,
    ts,
    source,
  ),
  in: buildLeg(
    inId,
    transferId,
    'transfer_in',
    draft.toWalletId,
    draft.toAmount,
    draft.toCurrency,
    draft,
    ts,
    source,
  ),
})

export async function createTransfer(draft: TransferDraft): Promise<string> {
  const transferId = newId()
  const ts = now()
  const legs = legsFor(transferId, newId(), newId(), draft, ts)
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.bulkPut([legs.out, legs.in])
    await db.outbox.add(createEntry(transferId, legs, ts))
  })
  schedulePush()
  return transferId
}

const createEntry = (
  transferId: string,
  legs: TransferLegs,
  ts: string,
): OutboxEntry => ({
  op: 'create',
  entity: 'transfer',
  id: transferId,
  payload: transferToCreateWire(transferId, legs),
  baseVersion: null,
  createdAt: ts,
})

/**
 * Many transfers in one Dexie transaction, each leg marked with `source` — the import's
 * batch marker, which is how an undo finds them again. Transfer ids already held are left
 * alone, so a retried import writes nothing twice.
 *
 * No push is scheduled: like `bulkAddTransactions`, the caller pushes once for the batch.
 */
export async function bulkAddTransfers(
  entries: ReadonlyArray<{ id: string; draft: TransferDraft }>,
  source: string | null,
): Promise<number> {
  if (entries.length === 0) return 0
  const ts = now()
  return db.transaction('rw', db.transactions, db.outbox, async () => {
    const held = await db.transactions
      .where('transferId')
      .anyOf(entries.map((entry) => entry.id))
      .toArray()
    const existing = new Set(held.map((leg) => leg.transferId))
    const fresh = entries
      .filter((entry) => !existing.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        legs: legsFor(entry.id, newId(), newId(), entry.draft, ts, source),
      }))
    await db.transactions.bulkPut(
      fresh.flatMap(({ legs }) => [legs.out, legs.in]),
    )
    await db.outbox.bulkAdd(
      fresh.map(({ id, legs }) => createEntry(id, legs, ts)),
    )
    return fresh.length
  })
}

/**
 * Rewrites the legs still held. A lone leg keeps its side: an OUT leg takes the source half
 * of the draft, an IN leg the destination half.
 */
export async function updateTransfer(
  transferId: string,
  draft: TransferDraft,
): Promise<void> {
  const ts = now()
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    const existing = await heldLegs(transferId)
    if (!existing.out && !existing.in) return
    const fresh = legsFor(
      transferId,
      existing.out?.id ?? '',
      existing.in?.id ?? '',
      draft,
      ts,
    )
    const keep = (
      leg: LocalTransaction,
      prior: LocalTransaction | undefined,
    ): LocalTransaction | undefined =>
      prior && {
        ...leg,
        createdAt: prior.createdAt,
        version: prior.version,
        source: prior.source,
      }
    const legs: HeldLegs = {
      out: keep(fresh.out, existing.out),
      in: keep(fresh.in, existing.in),
    }
    await db.transactions.bulkPut(
      [legs.out, legs.in].filter((l) => l !== undefined),
    )

    const entries = await pendingFor(transferId).toArray()
    const create = entries.find((e) => e.op === 'create')
    if (create && bothLegs(legs)) {
      create.payload = transferToCreateWire(transferId, legs)
      await db.outbox.put(requeued(create))
      return
    }
    const update = entries.find((e) => e.op === 'update')
    if (update) {
      update.payload = transferToUpdateWire(legs)
      await db.outbox.put(requeued(update))
      return
    }
    await db.outbox.add({
      op: 'update',
      entity: 'transfer',
      id: transferId,
      payload: transferToUpdateWire(legs),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
}

/** Removes every leg held locally; the server is told only if it ever heard of the transfer. */
export async function deleteTransfer(transferId: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    const entries = await pendingFor(transferId).toArray()
    const neverSynced = entries.some((e) => e.op === 'create')
    await pendingFor(transferId).delete()
    await db.transactions.where('transferId').equals(transferId).delete()
    if (neverSynced) return
    await db.outbox.add({
      op: 'delete',
      entity: 'transfer',
      id: transferId,
      payload: null,
      baseVersion: null,
      createdAt: now(),
    })
  })
  schedulePush()
}

/**
 * Delete many transfers — every leg of each — in one Dexie transaction. A transfer whose
 * create is still queued is dropped outright; the rest queue one `delete` each, which the
 * sync engine sends as `POST /transfers/bulk-delete`. Like `bulkAddTransfers`, no push.
 */
export async function bulkDeleteTransfers(
  transferIds: ReadonlyArray<string>,
): Promise<number> {
  if (transferIds.length === 0) return 0
  const ts = now()
  return db.transaction('rw', db.transactions, db.outbox, async () => {
    const queued = await db.outbox
      .where('[entity+id]')
      .anyOf(transferIds.map((id) => ['transfer', id]))
      .toArray()
    const neverSynced = new Set(
      queued.filter((e) => e.op === 'create').map((e) => e.id),
    )
    await db.outbox.bulkDelete(
      queued.map((entry) => entry.seq).filter((seq) => seq !== undefined),
    )
    await db.transactions
      .where('transferId')
      .anyOf([...transferIds])
      .delete()
    await db.outbox.bulkAdd(
      transferIds
        .filter((id) => !neverSynced.has(id))
        .map((id) => ({
          op: 'delete' as const,
          entity: 'transfer' as const,
          id,
          payload: null,
          baseVersion: null,
          createdAt: ts,
        })),
    )
    return transferIds.length
  })
}
