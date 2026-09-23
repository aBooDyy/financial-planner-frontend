import { db } from '#/db/db'
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
  } catch {
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

/** Push one `transfer` outbox entry. Throws on network/unexpected errors. */
export async function pushTransferEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushTransferCreate(entry)
  if (entry.op === 'update') return pushTransferUpdate(entry)
  return pushTransferDelete(entry)
}
