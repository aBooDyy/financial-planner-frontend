import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { bulkDeleteTransactions } from '#/features/transactions/data/mutations'
import { bulkDeleteTransfers } from '#/features/transactions/data/transfers'
import type { LocalImportBatch, LocalTransaction } from '#/db/types'

/**
 * The import history and its undo. A batch record is local-only — the durable fact is the
 * `source` marker on each transaction, which *is* synced, so an import committed on one
 * device can still be undone from another once the rows arrive (the history entry simply
 * will not be listed there).
 */

const CHUNK_SIZE = 200

const now = () => new Date().toISOString()

/** The marker every imported row carries, matching `recurring:<id>:<date>` and `email:<id>`. */
export const batchSource = (batchId: string): string => `csv:${batchId}`

export const batchIdFromSource = (source: string | null): string | null =>
  source !== null && source.startsWith('csv:') ? source.slice(4) : null

export async function saveBatch(batch: LocalImportBatch): Promise<void> {
  await db.importBatches.put(batch)
}

export async function listBatches(limit = 5): Promise<LocalImportBatch[]> {
  return db.importBatches.orderBy('createdAt').reverse().limit(limit).toArray()
}

/**
 * Our own writes set `createdAt` and `updatedAt` together, and a server create returns them
 * equal, so any difference is a later change — by the user here, or by something that
 * touched the row on another device.
 *
 * Deliberately *not* "updated later than the batch record": once a row has synced, its
 * `updatedAt` is the server's clock, which is always later than the local commit stamp —
 * that rule would call every synced row edited and make undo a no-op.
 */
const editedSince = (tx: LocalTransaction): boolean =>
  tx.updatedAt !== tx.createdAt

export type UndoPlan = {
  batch: LocalImportBatch
  /** Ledger rows the undo will remove. */
  removable: LocalTransaction[]
  /** Transfers the undo will remove — both legs of each. */
  removableTransfers: string[]
  /**
   * What changed since the import — listed in the dialog and left alone. A transfer is kept
   * whole when either leg changed, and is listed by its money-out leg.
   */
  edited: LocalTransaction[]
}

type TransferLegs = { legs: LocalTransaction[]; edited: boolean }

/** The batch's transfer legs, one entry per transfer. */
const byTransfer = (
  legs: ReadonlyArray<LocalTransaction>,
): Map<string, TransferLegs> => {
  const transfers = new Map<string, TransferLegs>()
  for (const leg of legs) {
    const id = leg.transferId as string
    const held = transfers.get(id) ?? { legs: [], edited: false }
    held.legs.push(leg)
    held.edited = held.edited || editedSince(leg)
    transfers.set(id, held)
  }
  return transfers
}

const shownLeg = (legs: ReadonlyArray<LocalTransaction>): LocalTransaction =>
  legs.find((leg) => leg.type === 'transfer_out') ?? legs[0]

export async function planUndo(batchId: string): Promise<UndoPlan | null> {
  const batch = await db.importBatches.get(batchId)
  if (!batch) return null
  const rows = await db.transactions
    .where('source')
    .equals(batchSource(batchId))
    .filter((tx) => tx.deleted === 0)
    .toArray()
  const ledger = rows.filter((tx) => tx.transferId === null)
  const transfers = [...byTransfer(rows.filter((tx) => tx.transferId !== null))]
  return {
    batch,
    removable: ledger.filter((tx) => !editedSince(tx)),
    removableTransfers: transfers
      .filter(([, held]) => !held.edited)
      .map(([id]) => id),
    edited: [
      ...ledger.filter(editedSince),
      ...transfers
        .filter(([, held]) => held.edited)
        .map(([, held]) => shownLeg(held.legs)),
    ],
  }
}

export type UndoResult = {
  removed: number
  removedTransfers: number
  kept: number
}

/**
 * Remove what the batch added, and only that. Accounts, categories and merchants the import
 * created are deliberately kept: they may already hold other rows by now, and silently
 * deleting an account the user can see is worse than leaving an empty one.
 */
export async function undoImport(batchId: string): Promise<UndoResult> {
  const plan = await planUndo(batchId)
  if (plan === null) return { removed: 0, removedTransfers: 0, kept: 0 }

  const ids = plan.removable.map((tx) => tx.id)
  for (let at = 0; at < ids.length; at += CHUNK_SIZE) {
    await bulkDeleteTransactions(ids.slice(at, at + CHUNK_SIZE))
  }
  // The ledger's own delete refuses a transfer leg; a transfer goes whole, by its id.
  const transfers = plan.removableTransfers
  for (let at = 0; at < transfers.length; at += CHUNK_SIZE) {
    await bulkDeleteTransfers(transfers.slice(at, at + CHUNK_SIZE))
  }
  await db.importBatches.put({ ...plan.batch, undoneAt: now() })
  schedulePush()
  return {
    removed: ids.length,
    removedTransfers: transfers.length,
    kept: plan.edited.length,
  }
}
