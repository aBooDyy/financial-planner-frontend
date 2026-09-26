import type { PlanCell } from '#/features/goals/data/goalDetail'
import { cn } from '#/lib/utils'

type Props = {
  cell: PlanCell
  /** Today's numbers, tinted so they read as the plan to look at. */
  current: boolean
  /** Right after a rewrite: the new plan, ringed. */
  emphasised?: boolean
}

/** One tile of the plan pair: "Saved plan · Jun 12 — SR 1,500/mo × 8 set-asides". */
export function PlanCellView({ cell, current, emphasised }: Props) {
  return (
    <div
      data-highlight={emphasised || undefined}
      className={cn(
        'min-w-0 rounded-[14px] px-3 py-[11px]',
        current ? 'bg-fp-accent-soft' : 'bg-fp-surface-2',
        emphasised && 'ring-[1.5px] ring-fp-accent',
      )}
    >
      <div
        className={cn(
          'text-[10.5px] font-bold tracking-[0.06em] uppercase',
          current ? 'text-fp-accent-ink' : 'text-fp-text-3',
        )}
      >
        {cell.label}
      </div>
      <div className="mt-[3px] text-[17px] font-extrabold text-fp-text tabular-nums">
        {cell.amountStr}
        <span className="text-[12px] font-bold text-fp-text-2">
          {cell.unit}
        </span>
      </div>
      <div className="text-[11.5px] text-fp-text-3">{cell.sub}</div>
    </div>
  )
}
