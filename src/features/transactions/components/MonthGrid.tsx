import type { MonthGridView } from '#/features/transactions/data/selectors'
import { FoldingGrid } from './FoldingGrid'

type Props = {
  grid: MonthGridView
  open: boolean
  onPick: (key: string) => void
}

export function MonthGrid({ grid, open, onPick }: Props) {
  return (
    <FoldingGrid
      rows={grid}
      cols="grid-cols-4"
      open={open}
      showBreakdown={(c) => c.hasActivity}
      onPick={onPick}
    />
  )
}
