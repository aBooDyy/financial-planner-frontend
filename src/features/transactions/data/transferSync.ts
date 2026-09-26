import { db } from '#/db/db'
import { flagEntry, invalidItemFailure } from '#/db/syncFailure'
import type { LocalTransaction, OutboxEntry } from '#/db/types'
import {
  transactionsApi,
  transfersApi,
} from '#/features/transactions/api/transactionsApi'
import type {
  CreateTransferWire,
  Transaction,
  UpdateTransferWire,
} from '#/features/transactions/api/types'
import { ApiError } from '#/lib/apiError'
import { serverTransactionToLocal, transferToUpdateWire } from './mappers'
import { pullTransactions } from './sync'
import { heldLegs } from './transfers'

/**
 * Push handlers for the `transfer` outbox entity. One entry moves both legs; the legs come
 * back as ordinary ledger rows, so the pull side needs nothing of its own.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

/** A stale version — the one 409 a rebase can fix, unlike `spending.transfer.id_taken`. */
const isConflict = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 409 && e.code === 'common.conflict'

async function storeLegs(
  entry: OutboxEntry,
  legs: ReadonlyArray<Transaction>,
): Promise<void> {
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.bulkPut(legs.map(serverTransactionToLocal))
    await db.outbox.delete(entry.seq)
  })
}

async function dropLocally(entry: OutboxEntry): Promise<void> {
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.where('transferId').equals(entry.id).delete()
    await db.outbox.delete(entry.seq)
  })
}

async function pushTransferCreate(entry: OutboxEntry): Promise<void> {
  try {
    const { legs } = await transfersApi.create(
      entry.payload as CreateTransferWire,
    )
    await storeLegs(entry, legs)
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    // An id is already taken: whatever the server holds is the truth. Clearing `dirty` lets
    // the full pull replace our legs, or drop them if the ids were never ours.
    await db.transaction('rw', db.transactions, db.outbox, async () => {
      await db.transactions
        .where('transferId')
        .equals(entry.id)
        .modify({ dirty: 0 })
      await db.outbox.delete(entry.seq)
    })
    await pullTransactions()
  }
}

async function pushTransferUpdate(entry: OutboxEntry): Promise<void> {
  try {
    const { legs } = await transfersApi.update(
      entry.id,
      entry.payload as UpdateTransferWire,
    )
    await storeLegs(entry, legs)
  } catch (e) {
    if (isConflict(e)) return rebaseTransfer(entry)
    if (statusOf(e) === 404) return dropLocally(entry)
    throw e
  }
}

/** Last-write-wins: re-send the local legs on the server's current versions, once. */
async function rebaseTransfer(entry: OutboxEntry): Promise<void> {
  const fresh = (await transactionsApi.list()).filter(
    (t) => t.transferId === entry.id,
  )
  const local = await heldLegs(entry.id)
  // A leg the server no longer holds went with its wallet; only the survivors are re-sent.
  const onServer = (leg: LocalTransaction | undefined) => {
    const current = fresh.find((t) => t.id === leg?.id)
    return leg && current ? { ...leg, version: current.version } : undefined
  }
  const rebased = { out: onServer(local.out), in: onServer(local.in) }
  if (!rebased.out && !rebased.in) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const { legs } = await transfersApi.update(
      entry.id,
      transferToUpdateWire(rebased),
    )
    await storeLegs(entry, legs)
  } catch (e) {
    if (!isConflict(e)) throw e
    await storeLegs(entry, fresh)
  }
}

async function pushTransferDelete(entry: OutboxEntry): Promise<void> {
  try {
    await transfersApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await dropLocally(entry)
}

/**
 * A run of queued transfer creates as one `POST /transfers/bulk`, answered per transfer the
 * way `pushTransactionCreates` answers rows: a written transfer stores its legs, a taken id
 * stores the legs the server sends back (or, when the id is not ours, leaves ours clean for
 * the pull to replace), an unusable one is flagged and stays queued. An entry the response
 * does not mention stays queued.
 */
export async function pushTransferCreates(
  entries: ReadonlyArray<OutboxEntry>,
): Promise<void> {
  const results = await transfersApi.bulkCreate(
    entries.map((entry) => entry.payload as CreateTransferWire),
  )
  const byId = new Map(results.map((result) => [result.id, result]))
  const foreign = results.some(
    (result) => result.status === 'taken' && result.transfer === null,
  )
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    for (const entry of entries) {
      const result = byId.get(entry.id)
      if (result === undefined) continue
      if (result.status === 'invalid') {
        await flagEntry(
          entry,
          invalidItemFailure(result.errorCode, result.errorField),
        )
        continue
      }
      if (result.transfer) {
        await db.transactions.bulkPut(
          result.transfer.legs.map(serverTransactionToLocal),
        )
      } else if (result.status === 'taken') {
        await db.transactions
          .where('transferId')
          .equals(entry.id)
          .modify({ dirty: 0 })
      }
      await db.outbox.delete(entry.seq)
    }
  })
  if (foreign) await pullTransactions()
}

/**
 * A run of queued transfer deletes as one `POST /transfers/bulk-delete`. A deleted or missing
 * transfer is dropped with whatever legs are still held; an invalid one is flagged.
 */
export async function pushTransferDeletes(
  entries: ReadonlyArray<OutboxEntry>,
): Promise<void> {
  const results = await transfersApi.bulkDelete(
    entries.map((entry) => entry.id),
  )
  const byId = new Map(results.map((result) => [result.id, result]))
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    for (const entry of entries) {
      const result = byId.get(entry.id)
      if (result === undefined) continue
      if (result.status === 'invalid') {
        await flagEntry(
          entry,
          invalidItemFailure(result.errorCode, result.errorField),
        )
        continue
      }
      await db.transactions.where('transferId').equals(entry.id).delete()
      await db.outbox.delete(entry.seq)
    }
  })
}

/** Push one `transfer` outbox entry. Throws on network/unexpected errors. */
export async function pushTransferEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushTransferCreate(entry)
  if (entry.op === 'update') return pushTransferUpdate(entry)
  return pushTransferDelete(entry)
}
