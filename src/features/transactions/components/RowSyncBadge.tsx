import type { SyncFailure } from '#/db/types'
import { SyncFailureBadge } from '#/components/sync/SyncFailureBadge'
import type { ActivityRow } from '#/features/transactions/data/selectors'
import {
  syncContextOf,
  syncEntityOf,
} from '#/features/transactions/data/syncFailures'
import { useSyncRetry } from '#/hooks/useSyncRetry'
import { describeSyncFailure } from '#/lib/syncFailureMessages'

type Props = {
  row: ActivityRow
  failure: SyncFailure
  onEdit: () => void
}

/** The "not synced" badge on one activity row, wired to retry that row's changes. */
export function RowSyncBadge({ row, failure, onEdit }: Props) {
  const { retry, retrying } = useSyncRetry(syncEntityOf(row), row.id)
  const text = describeSyncFailure(failure, syncContextOf(row))
  return (
    <SyncFailureBadge
      kind={failure.kind}
      text={text}
      onRetry={retry}
      retrying={retrying}
      onEdit={text.canFixByEditing ? onEdit : undefined}
    />
  )
}
