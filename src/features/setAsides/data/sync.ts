import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import { setAsidesApi } from '#/features/setAsides/api/setAsidesApi'
import type {
  CreateSetAsideWire,
  SetAside,
  UpdateSetAsideWire,
} from '#/features/setAsides/api/types'
import { ApiError } from '#/lib/apiError'
import { localSetAsideToUpdateWire, serverSetAsideToLocal } from './mappers'

/**
 * Push/pull handlers for set-asides, plugged into the shared sync engine (`db/sync.ts`): the
 * last-synced `version` is the optimistic base, a `409` rebases and retries once, a `404`
 * drops the local row, anything else bubbles up to be flagged.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

/**
 * Store rows an action answered with (a close, a release, a move) as the server now holds them.
 * They are the rows that action wrote, so they replace whatever this device held for them.
 */
export async function storeServerSetAsides(
  rows: ReadonlyArray<SetAside>,
): Promise<void> {
  if (rows.length === 0) return
  await db.setAsides.bulkPut(rows.map(serverSetAsideToLocal))
}

async function storeAndSettle(
  entry: OutboxEntry,
  row: SetAside,
): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.setAsides.put(serverSetAsideToLocal(row))
    await db.outbox.delete(entry.seq)
  })
}

async function pushSetAsideCreate(entry: OutboxEntry): Promise<void> {
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.create(entry.payload as CreateSetAsideWire),
    )
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullSetAsides()
      return
    }
    throw e
  }
}

async function pushSetAsideUpdate(entry: OutboxEntry): Promise<void> {
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.update(entry.id, entry.payload as UpdateSetAsideWire),
    )
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) return rebaseSetAside(entry)
    if (status === 404) {
      await db.transaction('rw', db.setAsides, db.outbox, async () => {
        await db.setAsides.delete(entry.id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseSetAside(entry: OutboxEntry): Promise<void> {
  const fresh = (await setAsidesApi.list()).find((a) => a.id === entry.id)
  const local = await db.setAsides.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    await storeAndSettle(
      entry,
      await setAsidesApi.update(
        entry.id,
        localSetAsideToUpdateWire({ ...local, version: fresh.version }),
      ),
    )
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await storeAndSettle(entry, fresh)
  }
}

async function pushSetAsideDelete(entry: OutboxEntry): Promise<void> {
  try {
    await setAsidesApi.del(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.setAsides.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

/** Push one `setAside` outbox entry. Throws on network/unexpected errors. */
export async function pushSetAsidesEntry(entry: OutboxEntry): Promise<void> {
  if (entry.op === 'create') return pushSetAsideCreate(entry)
  if (entry.op === 'update') return pushSetAsideUpdate(entry)
  return pushSetAsideDelete(entry)
}

/**
 * Set-asides are read in full, live and released alike, and absence is how a delete (or a
 * cascade from a deleted bill or goal) arrives. If the list ever grows too long for that, a
 * server-side delta stream is the follow-up.
 */
export async function pullSetAsides(): Promise<void> {
  const server = await setAsidesApi.list()
  const ids = new Set(server.map((a) => a.id))
  await db.transaction('rw', db.setAsides, async () => {
    for (const a of server) {
      const local = await db.setAsides.get(a.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.setAsides.put(serverSetAsideToLocal(a))
      }
    }
    for (const l of await db.setAsides.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) await db.setAsides.delete(l.id)
    }
  })
}

/**
 * An action this device applied locally (a close's releases and moved copies) was settled by
 * the server's own state instead — it was already closed, or the version could not be
 * reconciled. The rows it marked hold no outbox entries of their own, so they are cleaned and
 * the full pull replaces them with what the server holds (dropping copies it never wrote).
 */
export async function resyncSetAsides(
  ids: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    for (const id of ids) {
      const queued = await db.outbox
        .where('[entity+id]')
        .equals(['setAside', id])
        .count()
      if (queued === 0) await db.setAsides.update(id, { dirty: 0 })
    }
  })
  await pullSetAsides()
}
