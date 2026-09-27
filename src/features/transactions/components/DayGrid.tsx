import type { DayGridView } from '#/features/transactions/data/selectors'
import { FoldingGrid } from './FoldingGrid'

type Props = {
  grid: DayGridView
  open: boolean
  loading: boolean
  onPick: (key: string) => void
}

export function DayGrid({ grid, open, loading, onPick }: Props) {
  return (
    <FoldingGrid
      rows={grid}
      cols="grid-cols-7"
      open={open}
      loading={loading}
      showBreakdown={(c) => c.hasBoth}
      onPick={onPick}
    />
  )
}
