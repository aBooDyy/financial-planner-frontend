import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { CountBadge } from '#/features/planning/components/kit/CountBadge'
import { ByPaycheckList } from './ByPaycheckList'
import { UpcomingRail } from './UpcomingRail'
import { YearAheadView } from './YearAheadView'

type View = 'paycheck' | 'year'

/** Upcoming (04 §5): what is coming — by paycheck or across the year — and the payday review. */
export function UpcomingSection() {
  const planning = usePlanning()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const [view, setView] = useState<View>('paycheck')
  return (
    <>
      <div className="flex items-center gap-3">
        <h2 className="sr-only">Upcoming</h2>
        <div className="w-full max-w-[300px]">
          <PillSwitch<View>
            label="Show"
            options={[
              { value: 'paycheck', label: 'By paycheck' },
              { value: 'year', label: 'Year ahead' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <span className="flex-1" />
        <button
          type="button"
          disabled={planning.loading}
          onClick={() =>
            openSheet({
              kind: 'review',
              payday: planning.reviews.at(0)?.payday ?? null,
            })
          }
          className="flex flex-none items-center gap-[7px] rounded-[11px] border border-fp-border-strong bg-fp-surface px-[13px] py-[8px] text-[13px] font-bold hover:bg-fp-surface-2 disabled:opacity-60"
        >
          <ListChecks size={15} aria-hidden />
          Review
          {!planning.loading && planning.reviewCount > 0 ? (
            <CountBadge
              count={planning.reviewCount}
              tone="accent"
              label={`${planning.reviewCount} waiting for review`}
            />
          ) : null}
        </button>
      </div>
      {view === 'year' ? (
        <YearAheadView planning={planning} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-[14px]">
            <ByPaycheckList planning={planning} />
          </div>
          <UpcomingRail planning={planning} />
        </div>
      )}
    </>
  )
}
