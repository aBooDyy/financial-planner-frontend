/**
 * The outbox side of an ordinary local-first write: coalesce into what is already queued for
 * the row, or queue a new entry. Callers run these inside their own Dexie transaction (with
 * `db.outbox` in scope) next to the row write, and push once afterwards.
 */
import { db } from './db'
import { requeued } from './syncFailure'
import type { OutboxEntity, OutboxEntry } from './types'

const now = () => new Date().toISOString()

export const pendingFor = (entity: OutboxEntity, id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

/** Queue a create for a row the server has never seen. */
export async function enqueueCreate(
  entity: OutboxEntity,
  id: string,
  payload: unknown,
): Promise<void> {
  await db.outbox.add({
    op: 'create',
    entity,
    id,
    payload,
    baseVersion: null,
    createdAt: now(),
  })
}

/**
 * Fold an edit into the row's queued create (the server has not seen it yet) or its queued
 * update, else queue an update on the last-synced `version`. Rewriting an entry clears any
 * failure flagged on it: the edit is the user's answer to it.
 */
export async function enqueueUpsert(
  entity: OutboxEntity,
  id: string,
  version: string,
  createPayload: unknown,
  updatePayload: unknown,
): Promise<void> {
  const entries = await pendingFor(entity, id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    create.payload = createPayload
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  if (update) {
    update.payload = updatePayload
    update.baseVersion = version
    await db.outbox.put(requeued(update))
    return
  }
  await db.outbox.add({
    op: 'update',
    entity,
    id,
    payload: updatePayload,
    baseVersion: version,
    createdAt: now(),
  })
}

/**
 * Drop the row's queued entries and, when the server has seen it (no queued create), queue a
 * delete. Returns whether a delete was queued.
 */
export async function enqueueDelete(
  entity: OutboxEntity,
  id: string,
): Promise<boolean> {
  const neverSynced = (await pendingFor(entity, id).toArray()).some(
    (e) => e.op === 'create',
  )
  await pendingFor(entity, id).delete()
  if (neverSynced) return false
  await db.outbox.add({
    op: 'delete',
    entity,
    id,
    payload: null,
    baseVersion: null,
    createdAt: now(),
  })
  return true
}

/** Whether the row has queued entries other than `entry` — writes still waiting behind it. */
export async function queuedBesides(entry: OutboxEntry): Promise<boolean> {
  const others = await pendingFor(entry.entity, entry.id)
    .filter((e) => e.seq !== entry.seq)
    .count()
  return others > 0
}
