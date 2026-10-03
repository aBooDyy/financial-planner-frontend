import { Skeleton } from '#/components/ui/skeleton'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'

const MONTHS = 12
const COLUMNS = `168px repeat(${MONTHS}, minmax(0, 1fr))`
/** Each placeholder lane's bar as [first month, months spanned]. */
const LANES: ReadonlyArray<readonly [number, number]> = [
  [0, 12],
  [0, 12],
  [1, 5],
  [3, 9],
  [0, 8],
]
/** Rows in each placeholder month card on mobile. */
const MONTH_CARDS = [3, 2, 2]

/** Year ahead while the plan loads: lanes on desktop, month cards on mobile. */
export function YearAheadSkeleton({ desktop }: { desktop: boolean }) {
  if (!desktop)
    return (
      <div aria-hidden className="flex flex-col gap-3">
        {MONTH_CARDS.map((rows, i) => (
          <PlanCard key={i} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <span className="flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            {Array.from({ length: rows }, (_, r) => (
              <div
                key={r}
                className="flex items-center gap-3 border-t border-fp-border px-4 py-[11px]"
              >
                <Skeleton className="size-2 flex-none rounded-full" />
                <Skeleton className="h-3.5 w-2/5" />
                <span className="flex-1" />
                <Skeleton className="h-3.5 w-14" />
              </div>
            ))}
          </PlanCard>
        ))}
      </div>
    )
  return (
    <PlanCard className="overflow-hidden">
      <div aria-hidden>
        <div
          className="grid border-b border-fp-border"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span className="border-e border-fp-border" />
          {Array.from({ length: MONTHS }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-[6px] py-3">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
        {LANES.map(([from, span], i) => (
          <div
            key={i}
            className="grid items-center border-b border-fp-border last:border-b-0"
            style={{ gridTemplateColumns: COLUMNS }}
          >
            <div className="flex flex-col gap-[6px] border-e border-fp-border px-3 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton
              className="mx-2 h-[18px] rounded-full"
              style={{ gridColumn: `${from + 2} / span ${span}` }}
            />
          </div>
        ))}
      </div>
    </PlanCard>
  )
}
