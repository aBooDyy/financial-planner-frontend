import { Skeleton } from '#/components/ui/skeleton'

/** Placeholder planning rows while the plan loads: spine, name and meta lines, figure and chip. */
export function SkeletonItemRows({ count }: { count: number }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-stretch gap-3 border-t border-fp-border px-4 py-3 first:border-t-0"
        >
          <Skeleton className="w-1 flex-none self-stretch rounded-[3px]" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-[7px]">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <div className="flex flex-none flex-col items-end justify-center gap-[7px]">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-[18px] w-14 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}
