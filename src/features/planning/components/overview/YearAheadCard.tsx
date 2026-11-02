import { CardHeader } from '#/features/planning/components/kit/PlanCard'
import { YearAheadView } from '#/features/planning/components/upcoming/YearAheadView'
import type { PlanningView } from '#/features/planning/hooks/usePlanning'
import { useIsDesktop } from '#/hooks/useMediaQuery'

/** The year's lanes on phones, scrolling sideways. Desktop reads them in Upcoming. */
export function YearAheadCard({ planning }: { planning: PlanningView }) {
  const isDesktop = useIsDesktop()
  if (isDesktop) return null
  return (
    <YearAheadView
      planning={planning}
      compactLanes
      header={<CardHeader title="Year ahead" note="Swipe to see more" />}
    />
  )
}
