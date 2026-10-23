import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useManualScan } from '#/features/email-sync/hooks/useManualScan'
import type {
  ScanState,
  ScanSummary,
} from '#/features/email-sync/hooks/useManualScan'
import { useOnline } from '#/hooks/useOnline'
import { cn } from '#/lib/utils'

const tip = (
  state: ScanState,
  summary: ScanSummary | null,
  online: boolean,
): string => {
  if (!online) return 'Syncing your inboxes needs a connection'
  if (state.status === 'scanning') return 'Syncing your inboxes…'
  if (state.status === 'busy' || state.status === 'failed') return state.message
  return summary?.line ?? 'Sync your inboxes'
}

/** The review queue's one-tap inbox sync: an icon that spins while it runs and says what it found. */
export function ReviewSyncButton() {
  const { state, summary, scan } = useManualScan()
  const online = useOnline()
  const running = state.status === 'scanning' || state.status === 'busy'
  const failed = state.status === 'failed'
  const Icon = failed ? AlertTriangle : RefreshCw

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Sync inboxes"
          aria-busy={running || undefined}
          disabled={!online}
          onClick={() => void scan()}
          className={cn(
            'flex size-8 items-center justify-center rounded-[10px] border-[1.5px] border-fp-border bg-fp-surface text-fp-text-2 transition hover:border-fp-border-strong hover:text-fp-text disabled:opacity-40',
            failed && 'text-fp-danger',
          )}
        >
          <Icon
            size={15}
            strokeWidth={2.2}
            className={cn(running && 'animate-spin')}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-[260px] px-3 py-2">
        {tip(state, summary, online)}
      </TooltipContent>
    </Tooltip>
  )
}
