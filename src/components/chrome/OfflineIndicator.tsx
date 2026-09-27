import { CloudOff } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { useOnline } from '#/hooks/useOnline'
import { usePendingChangeCount } from '#/hooks/usePendingChangeCount'

const waitingLine = (count: number): string =>
  `${count} ${count === 1 ? 'change is' : 'changes are'} waiting to sync.`

/**
 * The nav's quiet "offline" mark. Being offline is a normal state for a local-first app, so
 * it reads as information, not an error; a press explains what that means.
 */
export function OfflineIndicator() {
  const online = useOnline()
  const pending = usePendingChangeCount()
  if (online) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Offline — changes sync when you reconnect"
          className="flex h-[34px] items-center gap-1.5 rounded-[10px] bg-fp-surface-2 px-[9px] text-[13px] font-semibold text-fp-text-2 outline-none hover:text-fp-text focus-visible:ring-2 focus-visible:ring-fp-accent/40 sm:px-[11px]"
        >
          <CloudOff size={16} strokeWidth={1.8} aria-hidden />
          <span className="hidden sm:inline">Offline</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex w-[264px] flex-col gap-1.5 p-[14px] text-[13px]"
      >
        <p className="font-bold text-fp-text">You’re offline</p>
        <p className="leading-[1.45] text-fp-text-2">
          Everything you add or change is saved on this device and syncs
          automatically when you’re back online.
        </p>
        {pending > 0 ? (
          <p className="text-[12.5px] text-fp-text-3">{waitingLine(pending)}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
