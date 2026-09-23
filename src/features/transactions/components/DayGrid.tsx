import type { DayGridView } from '#/features/transactions/data/selectors'
import { FoldingGrid } from './FoldingGrid'

type Props = {
  grid: DayGridView
  open: boolean
  onPick: (key: string) => void
}

export function DayGrid({ grid, open, onPick }: Props) {
  return (
    <>
      <div className="mb-[6px] grid grid-cols-7 gap-[6px]">
        {grid.weekdayLabels.map((w) => (
          <div
            key={w}
            className="text-center text-[10.5px] font-bold uppercase tracking-[0.03em] text-fp-text-3"
          >
            {w}
          </div>
        ))}
      </div>

      <FoldingGrid
        rows={grid}
        cols="grid-cols-7"
        open={open}
        showBreakdown={(c) => c.hasBoth}
        onPick={onPick}
      />
    </>
  )
}
