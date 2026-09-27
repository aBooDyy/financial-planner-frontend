import type { CSSProperties, ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  /** The column gap in px; each item's separator is centred in it. */
  gap: number
  className?: string
  children: ReactNode
}

/**
 * A line of `SeparatedItem`s that wraps when it runs out of room. The container clips
 * its inline edges, so an item that starts a line has its separator cut off.
 */
export function SeparatedWrap({ gap, className, children }: Props) {
  return (
    <span
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-(--sep-gap) gap-y-[2px] overflow-hidden',
        className,
      )}
      style={{ '--sep-gap': `${gap}px` } as CSSProperties}
    >
      {children}
    </span>
  )
}
