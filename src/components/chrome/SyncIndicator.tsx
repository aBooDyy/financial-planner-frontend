import { Cloud, RefreshCw } from 'lucide-react'
import { useSyncing } from '#/db/syncActivity'
import { useCalmFlag } from '#/hooks/useCalmFlag'
import { cn } from '#/lib/utils'

const SHOW_AFTER_MS = 300
const MIN_ON_MS = 700

/**
 * The nav's "syncing" mark: a cloud with turning arrows while changes travel to or from the
 * server. It stays mounted and collapses to nothing when idle, so it can fade both ways; the
 * negative margin cancels the parent's gap while collapsed.
 */
export function SyncIndicator() {
  const shown = useCalmFlag(useSyncing(), SHOW_AFTER_MS, MIN_ON_MS)

  return (
    <span
      title={shown ? 'Syncing…' : undefined}
      className={cn(
        'relative flex h-[34px] flex-none items-center justify-center overflow-hidden text-fp-text-3 transition-[width,margin,opacity] duration-300 ease-out',
        shown ? 'ms-0 w-[22px] opacity-100' : '-ms-[9px] w-0 opacity-0',
      )}
    >
      <span role="status" className="sr-only">
        {shown ? 'Syncing' : ''}
      </span>
      <Cloud size={20} strokeWidth={1.8} aria-hidden />
      <RefreshCw
        size={8}
        strokeWidth={3}
        aria-hidden
        className="absolute top-[13px] animate-spin [animation-duration:1.4s] motion-reduce:animate-none"
      />
    </span>
  )
}
