import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncActivityStore, useSyncing } from '#/db/syncActivity'
import { tallyFailures } from '#/db/syncFailure'
import type { FailureTally } from '#/db/syncFailure'
import { syncStatusOf } from '#/lib/syncStatus'
import type { SyncStatus } from '#/lib/syncStatus'
import { useCalmFlag } from './useCalmFlag'
import { usePendingChangeCount } from './usePendingChangeCount'

const SHOW_AFTER_MS = 300
const MIN_ON_MS = 700
const NO_FAILURES: FailureTally = { rejected: 0, unavailable: 0 }

/** Where sync stands right now, smoothed so quick passes never flash "syncing". */
export function useSyncStatus(): SyncStatus {
  const syncing = useCalmFlag(useSyncing(), SHOW_AFTER_MS, MIN_ON_MS)
  const lastSyncedAt = useSyncActivityStore((s) => s.lastSyncedAt)
  const lastPassFailed = useSyncActivityStore((s) => s.lastPassFailed)
  const pending = usePendingChangeCount()
  const failures = useLiveQuery(tallyFailures, [], NO_FAILURES)
  return syncStatusOf({
    syncing,
    pending,
    ...failures,
    lastPassFailed,
    lastSyncedAt,
  })
}
