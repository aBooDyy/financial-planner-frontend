import type { EntityTable } from 'dexie'
import { ApiError } from '#/lib/apiError'
import { db } from './db'
import { storeAnswer } from './storeAnswer'
import type { OutboxEntry } from './types'

export type TakenCreate<
  TServer,
  TLocal extends { id: string; version: string },
> = {
  table: EntityTable<TLocal, 'id'>
  /** The server's row under the entry's id; undefined when it has none. */
  find: () => Promise<TServer | undefined>
  toLocal: (server: TServer) => TLocal
  /** The PATCH that puts `local` on the server's row, at its version. */
  rebased: (local: TLocal, server: TServer) => unknown
  update: (body: unknown) => Promise<TServer>
  /** Whether more writes for the row wait behind the create. */
  queued: () => Promise<boolean>
}

const sameBody = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * A create refused because its id is taken. Ids are minted on the device (or derived from the
 * user and the occurrence, for auto-confirms), so the row is this user's own: an earlier send
 * that landed while its answer was lost, or another device writing the same occurrence. The
 * server's row is adopted — with this device's edits re-applied on it when they differ — so
 * the row ends clean: a pull never overwrites a dirty row, so leaving it dirty would strand it.
 * A row the server no longer has was deleted there since, and goes here too.
 */
export async function settleTakenCreate<
  TServer,
  TLocal extends { id: string; version: string },
>(entry: OutboxEntry, taken: TakenCreate<TServer, TLocal>): Promise<void> {
  const row = () => taken.table.where('id').equals(entry.id)
  const server = await taken.find()
  const local = await row().first()
  const answer =
    server !== undefined && local
      ? await reapplied(local, server, taken)
      : server
  await db.transaction('rw', taken.table, db.outbox, async () => {
    await db.outbox.delete(entry.seq)
    const queued = await taken.queued()
    if (answer !== undefined)
      await storeAnswer(taken.table, taken.toLocal(answer), queued)
    else if (!queued) await row().delete()
  })
}

async function reapplied<
  TServer,
  TLocal extends { id: string; version: string },
>(
  local: TLocal,
  server: TServer,
  taken: TakenCreate<TServer, TLocal>,
): Promise<TServer> {
  const body = taken.rebased(local, server)
  if (sameBody(body, taken.rebased(taken.toLocal(server), server)))
    return server
  try {
    return await taken.update(body)
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return server
    throw e
  }
}
