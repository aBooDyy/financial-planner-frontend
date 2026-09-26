import type { PeriodCell } from '#/features/transactions/data/selectors'
import { CalendarCell } from './CalendarCell'

type Rows = {
  pivotRow: PeriodCell[]
  rowsBefore: PeriodCell[][]
  rowsAfter: PeriodCell[][]
}

type Props = {
  rows: Rows
  /** Tailwind grid-cols class for one row. */
  cols: string
  open: boolean
  loading: boolean
  showBreakdown: (cell: PeriodCell) => boolean
  onPick: (key: string) => void
}

const CELL_HEIGHT = 'h-[52px] md:h-[58px]'
const GAP = 6
const ROW_HEIGHT = 58 + GAP

export function FoldingGrid({
  rows,
  cols,
  open,
  loading,
  showBreakdown,
  onPick,
}: Props) {
  const row = (cells: PeriodCell[]) => (
    <div className={`grid gap-[6px] ${cols}`}>
      {cells.map((c) => (
        <CalendarCell
          key={c.key}
          cell={c}
          showBreakdown={showBreakdown(c)}
          loading={loading}
          height={CELL_HEIGHT}
          onPick={onPick}
        />
      ))}
    </div>
  )

  const fold = (weeks: PeriodCell[][], from: 'top' | 'bottom') => (
    <div
      style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: from === 'top' ? 'flex-end' : 'flex-start',
        maxHeight: open ? `${weeks.length * ROW_HEIGHT + GAP}px` : '0px',
        opacity: open ? 1 : 0,
        transition:
          'max-height .36s cubic-bezier(.22,.78,.27,1), opacity .26s ease',
      }}
    >
      {weeks.map((cells, i) => (
        <div key={i} className={from === 'top' ? 'mb-[6px]' : 'mt-[6px]'}>
          {row(cells)}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {fold(rows.rowsBefore, 'top')}
      {row(rows.pivotRow)}
      {fold(rows.rowsAfter, 'bottom')}
    </>
  )
}
