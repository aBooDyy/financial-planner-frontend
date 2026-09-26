import type { OutboxEntity, SyncFailure } from '#/db/types'
import { useSyncFailure } from './useSyncFailures'
import { useSyncRetry } from './useSyncRetry'

/** One row's sync failure (live) with its "Retry now" — what an editor needs to show it. */
export function useRowSyncFailure(
  entity: OutboxEntity,
  id: string | null,
): { failure: SyncFailure | null; retry: () => void; retrying: boolean } {
  const failure = useSyncFailure(entity, id)
  const { retry, retrying } = useSyncRetry(entity, id)
  return { failure, retry, retrying }
}
