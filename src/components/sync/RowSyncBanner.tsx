import type { OutboxEntity } from '#/db/types'
import { useRowSyncFailure } from '#/hooks/useRowSyncFailure'
import { describeSyncFailure } from '#/lib/syncFailureMessages'
import { SyncFailureBanner } from './SyncFailureBanner'

/** The sync banner for an editor that only needs to show it, not mark fields by it. */
export function RowSyncBanner({
  entity,
  id,
}: {
  entity: OutboxEntity
  id: string
}) {
  const { failure, retry, retrying } = useRowSyncFailure(entity, id)
  if (!failure) return null
  return (
    <SyncFailureBanner
      kind={failure.kind}
      text={describeSyncFailure(failure)}
      onRetry={retry}
      retrying={retrying}
    />
  )
}
