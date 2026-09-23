import type { GoalsView } from '#/features/goals/data/selectors'
import { MonthlyPlanCard } from './MonthlyPlanCard'
import { SectionHeader } from './SectionHeader'
import { TimelineCard } from './TimelineCard'

export function TimelineSection({ view }: { view: GoalsView }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SectionHeader
        title="Timeline"
        sub="Every goal & obligation, by the month it's covered"
      />
      <TimelineCard view={view} />
      <MonthlyPlanCard view={view} />
    </div>
  )
}
