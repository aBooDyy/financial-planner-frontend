import type { SyncStatusText } from '#/lib/syncStatus'
import { cn } from '#/lib/utils'

/** What the sync cloud means right now — the body of its tooltip and popover. */
export function SyncStatusBody({
  text,
  className,
}: {
  text: SyncStatusText
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1 text-start', className)}>
      <span className="text-[13px] font-bold">{text.title}</span>
      <span className="text-[12.5px] leading-[1.45] opacity-90">
        {text.hint}
      </span>
      {text.meta ? (
        <span className="text-[12px] leading-[1.45] opacity-70">
          {text.meta}
        </span>
      ) : null}
    </div>
  )
}
