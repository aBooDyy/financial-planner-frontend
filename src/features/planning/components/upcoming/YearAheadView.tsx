import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { PlanningView } from '#/features/planning/hooks/usePlanning'
import { useYearAhead } from '#/features/planning/hooks/useYearAhead'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import { YearAheadSkeleton } from './YearAheadSkeleton'
import { YearLanes } from './YearLanes'
import { YearMonthCards } from './YearMonthCards'

/** Year ahead (04 §5): lanes on desktop, a list of month cards on mobile (D22). */
export function YearAheadView({ planning }: { planning: PlanningView }) {
  const ahead = useYearAhead()
  const { inputs } = usePlannedData()
  const isDesktop = useIsDesktop()
  const openDetail = usePlanningUi((s) => s.openDetail)
  const openSheet = usePlanningUi((s) => s.openSheet)
  if (ahead.loading) return <YearAheadSkeleton desktop={isDesktop} />
  if (ahead.months.length === 0) return null
  const open = (kind: 'bill' | 'goal', id: string) =>
    openDetail(kind === 'bill' ? billOwner(id) : goalOwner(id))
  return isDesktop ? (
    <YearLanes
      ahead={ahead}
      bills={inputs.bills}
      goals={inputs.goals}
      base={inputs.base}
      rates={inputs.rates}
      calendar={planning.calendar}
      goalStatus={planning.goals}
      onOpen={open}
      onReview={() => openSheet({ kind: 'review', payday: null })}
    />
  ) : (
    <YearMonthCards
      ahead={ahead}
      bills={inputs.bills}
      goals={inputs.goals}
      base={inputs.base}
      onOpen={open}
    />
  )
}
