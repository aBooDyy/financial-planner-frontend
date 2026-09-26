import type { ReactNode } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

type Props = {
  /** The loaded value; `null` or `undefined` while it is still loading. */
  value: ReactNode
  /** Sizes the placeholder like the value it stands in for. */
  className: string
}

/** A data-driven value, or a skeleton the size of it until the value has loaded. */
export function ValueOrSkeleton({ value, className }: Props) {
  if (value === null || value === undefined)
    return (
      <Skeleton
        aria-hidden
        className={cn('inline-block max-w-full align-middle', className)}
      />
    )
  return <>{value}</>
}
