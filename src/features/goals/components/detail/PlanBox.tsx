import type { GoalDetailView } from '#/features/goals/data/goalDetail'
import { PlanBand } from './PlanBand'
import { PlanCellView } from './PlanCellView'

type Props = {
  plan: NonNullable<GoalDetailView['plan']>
  band: GoalDetailView['band']
  busy: boolean
  onRecalc: () => void
  onConfirm: (plannedId: string) => void
  onUndo: () => void
}

/** The stored plan next to today's numbers, and what to do about the difference. */
export function PlanBox({ plan, band, ...actions }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-2">
        {plan.left ? <PlanCellView cell={plan.left} current={false} /> : null}
        <div className={plan.left ? undefined : 'col-span-2'}>
          <PlanCellView
            cell={plan.right}
            current
            emphasised={plan.highlightRight}
          />
        </div>
      </div>
      {band ? <PlanBand band={band} {...actions} /> : null}
    </>
  )
}
