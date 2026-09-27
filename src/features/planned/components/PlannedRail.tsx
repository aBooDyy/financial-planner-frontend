import type { UsePlanned } from '#/features/planned/hooks/usePlanned'
import { usePlannedOutlook } from '#/features/planned/hooks/usePlannedOutlook'
import { ForecastCard } from './ForecastCard'
import { HeadedCard } from './HeadedCard'
import { PlanningGuideCard } from './PlanningGuideCard'

type Props = {
  planned: UsePlanned
  /** Every live account's balance in base, or `null` while it loads. */
  balance: number | null
}

/** The Planned tab's side column. */
export function PlannedRail({ planned, balance }: Props) {
  const { forecast, headed } = usePlannedOutlook(planned, balance)
  if (!planned.loading && planned.isEmpty) return <PlanningGuideCard />
  return (
    <>
      <ForecastCard view={forecast} />
      <HeadedCard view={headed} />
    </>
  )
}
