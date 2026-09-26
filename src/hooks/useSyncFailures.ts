import { useLiveQuery } from 'dexie-react-hooks'
import { failureOfRow, failuresByRow } from '#/db/syncFailure'
import type { OutboxEntity, SyncFailure } from '#/db/types'

const NONE: ReadonlyMap<string, SyncFailure> = new Map()

/**
 * The first sync failure of every row of these entities, keyed by row id. One live query for
 * a whole list, so a long ledger does not open one per row.
 */
export function useFailedSyncIds(
  entities: ReadonlyArray<OutboxEntity>,
): ReadonlyMap<string, SyncFailure> {
  const key = entities.join(',')
  return (
    useLiveQuery(
      () => failuresByRow(key.split(',') as OutboxEntity[]),
      [key],
    ) ?? NONE
  )
}

/** One row's first sync failure, or null while it has none. */
export function useSyncFailure(
  entity: OutboxEntity,
  id: string | null,
): SyncFailure | null {
  return (
    useLiveQuery(() => (id ? failureOfRow(entity, id) : null), [entity, id]) ??
    null
  )
}
