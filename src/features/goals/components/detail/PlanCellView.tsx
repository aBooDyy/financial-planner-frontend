import type { PlanCell } from '#/features/goals/data/goalDetail'

/** One side of the plan box: "Saved plan · Jun 12 — SR 1,500/mo × 8 set-asides". */
export function PlanCellView({ cell }: { cell: PlanCell }) {
  return (
    <>
      <div className="text-[10.5px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
        {cell.label}
      </div>
      <div className="mt-1 text-[17px] font-extrabold tabular-nums">
        {cell.amountStr}
        <span className="text-[11px] font-semibold text-fp-text-3">
          {cell.unit}
        </span>
      </div>
      <div className="mt-px text-[11px] text-fp-text-3">{cell.sub}</div>
    </>
  )
}
