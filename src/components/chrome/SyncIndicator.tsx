import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useFlashOnEnter } from '#/hooks/useFlashOnEnter'
import { useOnline } from '#/hooks/useOnline'
import { useSyncNow } from '#/hooks/useSyncRetry'
import { useSyncStatus } from '#/hooks/useSyncStatus'
import { describeSyncStatus } from '#/lib/syncStatus'
import type { SyncStatus } from '#/lib/syncStatus'
import { cn } from '#/lib/utils'
import { useDirectionStore } from '#/stores/direction'
import { SyncCloudGlyph } from './SyncCloudGlyph'
import type { SyncGlyph } from './SyncCloudGlyph'
import { SyncStatusBody } from './SyncStatusBody'

const DONE_HOLD_MS = 2500

const glyphOf = (status: SyncStatus): SyncGlyph =>
  status.state === 'synced'
    ? 'check'
    : status.state === 'failed'
      ? 'alert'
      : 'sync'

const toneOf = (status: SyncStatus, justSynced: boolean): string => {
  if (status.state === 'failed') {
    return status.rejected > 0 ? 'text-fp-danger' : 'text-fp-warn'
  }
  return justSynced ? 'text-fp-accent' : 'text-fp-text-3'
}

/** Quiet once all is synced; trouble stays until it clears. */
const isShown = (status: SyncStatus, justSynced: boolean): boolean =>
  justSynced ||
  status.state === 'syncing' ||
  status.state === 'waiting' ||
  status.state === 'failed'

/**
 * The nav's sync cloud: turning arrows while changes travel, a check that shows briefly once
 * everything is up, an alert that stays while something didn't make it. Whenever it shows,
 * hovering says what it means; a press — the only way on touch — says the same, with Retry
 * now when there's trouble. Offline, the offline pill speaks instead.
 *
 * It stays mounted and collapses to nothing when hidden, so it can fade both ways; the
 * negative margin cancels the parent's gap while collapsed.
 */
export function SyncIndicator() {
  const online = useOnline()
  const status = useSyncStatus()
  const locale = useDirectionStore((s) => s.locale)
  const justSynced = useFlashOnEnter(status.state === 'synced', DONE_HOLD_MS)
  const { retry, retrying } = useSyncNow()
  const [open, setOpen] = useState(false)
  if (!online) return null

  const text = describeSyncStatus(status, locale)
  const glyph = glyphOf(status)
  const shown = open || isShown(status, justSynced)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span role="status" className="sr-only">
        {status.state === 'syncing' ? 'Syncing' : ''}
      </span>
      <span
        inert={!shown}
        className={cn(
          'flex flex-none justify-center overflow-hidden transition-[width,margin,opacity] duration-300 ease-out',
          shown ? 'ms-0 w-[30px] opacity-100' : '-ms-[9px] w-0 opacity-0',
        )}
      >
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Sync: ${text.title}`}
                className={cn(
                  'flex h-[34px] w-[30px] flex-none items-center justify-center rounded-[10px] outline-none transition-colors duration-500 hover:bg-fp-surface-2 focus-visible:ring-2 focus-visible:ring-fp-accent/40',
                  toneOf(status, justSynced),
                )}
              >
                <SyncCloudGlyph
                  glyph={glyph}
                  spinning={status.state === 'syncing'}
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="max-w-[260px] px-3 py-2">
            <SyncStatusBody text={text} />
          </TooltipContent>
        </Tooltip>
      </span>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex w-[280px] flex-col gap-3 p-[14px]"
      >
        <div className="flex items-start gap-[10px]">
          <SyncCloudGlyph
            glyph={glyph}
            spinning={status.state === 'syncing'}
            size={18}
            className={cn('mt-px flex-none', toneOf(status, false))}
          />
          <SyncStatusBody text={text} className="text-fp-text" />
        </div>
        {status.state === 'failed' ? (
          <Button
            type="button"
            size="sm"
            className="rounded-[10px]"
            disabled={retrying}
            onClick={retry}
          >
            {retrying ? 'Retrying…' : 'Retry now'}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
