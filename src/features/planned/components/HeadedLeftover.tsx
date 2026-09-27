import type { HeadedView } from '#/features/planned/data/headed'
import { cn } from '#/lib/utils'

/** "SR 2,000 of what comes in has no plan yet" / "SR 400 more planned than comes in". */
export function HeadedLeftover({
  leftover,
}: {
  leftover: HeadedView['leftover']
}) {
  return (
    <p className="border-t border-fp-border pt-3 text-[12.5px] text-fp-text-2">
      {leftover.valueStr ? (
        <span
          className={cn(
            'fp-sensitive font-bold tabular-nums',
            leftover.kind === 'over' ? 'text-fp-warn' : 'text-fp-accent-ink',
          )}
        >
          {leftover.valueStr}{' '}
        </span>
      ) : null}
      {leftover.text}
    </p>
  )
}
