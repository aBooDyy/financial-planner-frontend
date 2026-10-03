import { PlanCard } from '#/features/planning/components/kit/PlanCard'
import { SkeletonItemRows } from '#/features/planning/components/kit/SkeletonItemRows'
import { SectionHeading } from './SectionHeading'

type Props = {
  title: string
  addLabel: string
  onAdd: () => void
}

/** A list section while the plan loads: its real heading and add button, rows as skeletons. */
export function LoadingList({ title, addLabel, onAdd }: Props) {
  return (
    <>
      <SectionHeading title={title} loading addLabel={addLabel} onAdd={onAdd} />
      <PlanCard className="overflow-hidden">
        <SkeletonItemRows count={3} />
      </PlanCard>
    </>
  )
}
