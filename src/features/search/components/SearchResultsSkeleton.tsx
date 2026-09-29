import { Skeleton } from '#/components/ui/skeleton'
import { SkeletonRows } from '#/features/transactions/components/SkeletonRows'

/** Stands in for the first results while the data they come from is read. */
export function SearchResultsSkeleton() {
  return (
    <div aria-hidden>
      <div className="px-4 pt-3 pb-2">
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="bg-fp-surface-2 px-4 pt-[9px] pb-[6px]">
        <Skeleton className="h-2.5 w-24" />
      </div>
      <SkeletonRows
        count={5}
        rowClassName="border-b border-fp-border px-4 py-[10px]"
      />
    </div>
  )
}
