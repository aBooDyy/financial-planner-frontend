import { OfflineNotice } from '#/components/OfflineNotice'
import { useManualScan } from '#/features/email-sync/hooks/useManualScan'
import { useOnline } from '#/hooks/useOnline'
import { cn } from '#/lib/utils'
import { OlderEmailsMenu } from './OlderEmailsMenu'
import { ScanResultLine } from './ScanResultLine'
import { SyncNowButton } from './SyncNowButton'

type Props = {
  /** Scope the sync to one inbox. Omitted syncs every connected inbox. */
  connectionId?: string
  /** Button only: no backfill menu, no review link, no offline line — for tight headers. */
  compact?: boolean
  label?: string
  /** The result line sits in a tinted box once there is one. */
  boxed?: boolean
  className?: string
}

/**
 * Sync now reads everything since the last sync, repeating until the inbox is caught up; the
 * menu beside it re-reads an older window. Until background sync lands, this is how new mail
 * arrives outside of opening the app.
 */
export function ScanNowControl({
  connectionId,
  compact = false,
  label,
  boxed = false,
  className,
}: Props) {
  const { state, summary, scan } = useManualScan()
  const online = useOnline()
  const running = state.status === 'scanning' || state.status === 'busy'
  const sync = () => {
    if (online) void scan({ connectionId })
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SyncNowButton
          state={state}
          onSync={sync}
          label={label}
          disabled={!online}
        />
        {compact ? null : (
          <OlderEmailsMenu
            disabled={running || !online}
            onPick={(days) => void scan({ connectionId, lookbackDays: days })}
          />
        )}
      </div>
      {online || compact ? null : (
        <OfflineNotice>Syncing your inbox needs a connection.</OfflineNotice>
      )}
      <ScanResultLine
        state={state}
        summary={summary}
        onRetry={sync}
        reviewLink={!compact}
        boxed={boxed}
      />
    </div>
  )
}
