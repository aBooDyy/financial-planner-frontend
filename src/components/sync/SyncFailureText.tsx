import type { SyncFailureText as Text } from '#/lib/syncFailureMessages'
import { cn } from '#/lib/utils'

/** Title, what happened, and what to do — the body of the badge's tooltip and popover. */
export function SyncFailureText({
  text,
  className,
}: {
  text: Text
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1 text-start', className)}>
      <span className="text-[13px] font-bold">{text.title}</span>
      <span className="text-[12.5px] leading-[1.45] opacity-90">
        {text.detail}
      </span>
      <span className="text-[12.5px] leading-[1.45] font-semibold">
        {text.hint}
      </span>
    </div>
  )
}
