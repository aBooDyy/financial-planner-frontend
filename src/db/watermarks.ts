import { useSessionStore } from '#/stores/session'
import { db } from './db'

/** The entities that pull incrementally. Everything else is bounded and pulls in full. */
export type DeltaEntityName =
  | 'transaction'
  | 'merchant'
  | 'merchantAlias'
  | 'inboundImport'
  | 'planned'

/**
 * A watermark is scoped to the signed-in user, not just the entity. Sign-out wipes the
 * table along with the rest of the local database, but that wipe is best-effort — and a
 * watermark that outlived its owner would hand the next user of this device a stranger's
 * `since`, whose delta silently omits every row older than it.
 */
const keyFor = (entity: DeltaEntityName): string | null => {
  const userId = useSessionStore.getState().user?.id
  return userId ? `${userId}:${entity}` : null
}

/** Null means "no usable watermark": the caller must sync as if for the first time. */
export async function readWatermark(
  entity: DeltaEntityName,
): Promise<string | null> {
  const key = keyFor(entity)
  if (!key) return null
  return (await db.syncState.get(key))?.since ?? null
}

export async function writeWatermark(
  entity: DeltaEntityName,
  since: string,
): Promise<void> {
  const key = keyFor(entity)
  if (!key) return
  await db.syncState.put({
    id: key,
    since,
    updatedAt: new Date().toISOString(),
  })
}

export async function clearWatermark(entity: DeltaEntityName): Promise<void> {
  const key = keyFor(entity)
  if (key) await db.syncState.delete(key)
}
