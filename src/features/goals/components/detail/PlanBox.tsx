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
    <div className="overflow-hidden rounded-[12px] border border-fp-border">
      <div className={`grid ${plan.left ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {plan.left ? (
          <div className="border-e border-fp-border px-3 py-[11px]">
            <PlanCellView cell={plan.left} />
          </div>
        ) : null}
        <div
          data-highlight={plan.highlightRight || undefined}
          className={`px-3 py-[11px] ${plan.highlightRight ? 'bg-fp-accent-soft' : ''}`}
        >
          <PlanCellView cell={plan.right} />
        </div>
      </div>
      {band ? <PlanBand band={band} {...actions} /> : null}
    </div>
  )
}
