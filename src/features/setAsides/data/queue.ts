/**
 * What the outbox still holds for one set-aside. A batch (release, move) writes rows besides
 * the one it is keyed by, so a row's queued writes are its own entries plus every batch that
 * names it in `alsoRows`.
 */
import { db } from '#/db/db'

/** Whether a queued release or move writes this row. */
export async function touchedByBatch(id: string): Promise<boolean> {
  const batches = await db.outbox
    .filter(
      (e) =>
        e.entity === 'setAside' &&
        (e.op === 'release' || e.op === 'move') &&
        (e.id === id || (e.alsoRows ?? []).includes(id)),
    )
    .count()
  return batches > 0
}

/** Whether anything queued still writes this row. */
export async function hasQueuedWrites(id: string): Promise<boolean> {
  const own = await db.outbox
    .where('[entity+id]')
    .equals(['setAside', id])
    .count()
  return own > 0 || touchedByBatch(id)
}
