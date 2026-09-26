import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { SyncFailure } from '#/db/types'
import type { SyncFailureText as Text } from '#/lib/syncFailureMessages'
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
import { SyncFailureIcon } from './SyncFailureIcon'
import { SyncFailureText } from './SyncFailureText'

type Props = {
  kind: SyncFailure['kind']
  text: Text
  onRetry: () => void
  retrying: boolean
  /** Opens the row's editor; offered only when editing can fix it. */
  onEdit?: () => void
}

// The popover is portalled but React still bubbles its events through this subtree, so one
// stop here keeps every press on the badge or its popover away from the row it sits in.
const keepFromRow = (e: SyntheticEvent) => e.stopPropagation()

/**
 * A row's "not synced" mark. Hovering shows why (tooltip); a press — the only way on touch —
 * opens the same text with Retry now and Edit.
 */
export function SyncFailureBadge({
  kind,
  text,
  onRetry,
  retrying,
  onEdit,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <span className="inline-flex flex-none" onClick={keepFromRow}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Not synced: ${text.title}`}
                className="-m-1 flex size-7 items-center justify-center rounded-full outline-none hover:bg-fp-surface-2 focus-visible:ring-2 focus-visible:ring-fp-accent/40"
              >
                <SyncFailureIcon kind={kind} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="max-w-[260px] px-3 py-2">
            <SyncFailureText text={text} />
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="flex w-[280px] flex-col gap-3 p-[14px]"
        >
          <div className="flex items-start gap-[10px]">
            <SyncFailureIcon
              kind={kind}
              size={17}
              className="mt-px flex-none"
            />
            <SyncFailureText text={text} className="text-fp-text" />
          </div>
          <div className="flex gap-2">
            {onEdit ? (
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="flex-1 rounded-[10px]"
                onClick={() => {
                  setOpen(false)
                  onEdit()
                }}
              >
                Edit
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-[10px]"
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? 'Retrying…' : 'Retry now'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  )
}
