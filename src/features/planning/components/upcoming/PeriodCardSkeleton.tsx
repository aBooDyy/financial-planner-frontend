import { Skeleton } from '#/components/ui/skeleton'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'

/** A pay period on Upcoming while the plan loads: label, title and range, rows and footer. */
export function PeriodCardSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="mx-1 my-[2px] h-3 w-24" />
      <PlanCard className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <ul>
          {Array.from({ length: rows }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 border-t border-fp-border px-4 py-[11px]"
            >
              <Skeleton className="size-[30px] flex-none rounded-[9px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-3.5 w-16 flex-none" />
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-fp-border bg-fp-surface-2 px-4 py-3">
          <Skeleton className="h-3.5 w-36 bg-fp-border" />
          <Skeleton className="h-4 w-20 bg-fp-border" />
        </div>
      </PlanCard>
    </div>
  )
}
