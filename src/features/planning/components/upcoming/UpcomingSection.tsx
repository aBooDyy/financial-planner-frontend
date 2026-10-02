import { ListChecks } from 'lucide-react'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { CountBadge } from '#/features/planning/components/kit/CountBadge'
import { ByPaycheckList } from './ByPaycheckList'

/** Upcoming (04 §5): what is coming, by paycheck, and the payday review. */
export function UpcomingSection() {
  const planning = usePlanning()
  const openSheet = usePlanningUi((s) => s.openSheet)
  if (planning.loading) return null
  return (
    <>
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-[20px] font-extrabold tracking-[-0.01em]">
          Upcoming
        </h2>
        <button
          type="button"
          onClick={() =>
            openSheet({
              kind: 'review',
              payday: planning.reviews.at(0)?.payday ?? null,
            })
          }
          className="flex items-center gap-[7px] rounded-[11px] border border-fp-border-strong bg-fp-surface px-[13px] py-[8px] text-[13px] font-bold hover:bg-fp-surface-2"
        >
          <ListChecks size={15} aria-hidden />
          Review
          {planning.reviewCount > 0 ? (
            <CountBadge
              count={planning.reviewCount}
              tone="accent"
              label={`${planning.reviewCount} waiting for review`}
            />
          ) : null}
        </button>
      </div>
      <ByPaycheckList planning={planning} />
    </>
  )
}
