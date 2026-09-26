import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { ScanState } from '#/features/email-sync/hooks/useManualScan'
import { cn } from '#/lib/utils'

type Props = {
  state: ScanState
  onSync: () => void
  label?: string
  disabled?: boolean
  variant?: 'default' | 'outline'
  className?: string
}

const scanningLabel = (state: ScanState): string =>
  state.status === 'scanning' && state.round > 1 ? 'Catching up…' : 'Syncing…'

/** Sync from where the last sync stopped. Disabled while a sync — ours or another — runs. */
export function SyncNowButton({
  state,
  onSync,
  label = 'Sync now',
  disabled = false,
  variant = 'default',
  className,
}: Props) {
  const running = state.status === 'scanning' || state.status === 'busy'
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onSync}
      disabled={running || disabled}
      className={cn(
        'shrink-0 gap-1.5 px-[14px] py-[9px] text-[13px]',
        variant === 'outline' && 'bg-fp-surface font-semibold',
        className,
      )}
    >
      {running ? (
        <Loader2 size={15} strokeWidth={2} className="animate-spin" />
      ) : (
        <RefreshCw size={15} strokeWidth={2} />
      )}
      {running ? scanningLabel(state) : label}
    </Button>
  )
}
