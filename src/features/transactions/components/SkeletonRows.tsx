import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

type Props = {
  count: number
  /** The real row's own box (padding, border), so the placeholders sit where rows will. */
  rowClassName: string
}

/** Placeholder rows inside a list card while its rows load: icon chip, two lines, an amount. */
export function SkeletonRows({ count, rowClassName }: Props) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-3', rowClassName)}>
          <Skeleton className="size-[38px] flex-none rounded-[11px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16 flex-none" />
        </div>
      ))}
    </div>
  )
}
