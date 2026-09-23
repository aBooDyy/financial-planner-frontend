import { RED } from '#/features/transactions/constants'
import type { PeriodCell } from '#/features/transactions/data/selectors'

type Props = {
  cell: PeriodCell
  /** Show the income/spend split under the net figure. */
  showBreakdown: boolean
  height: string
  onPick: (key: string) => void
}

type Palette = {
  bg: string | undefined
  border: string
  label: string
  net: string
  inc: string
  spend: string
}

/**
 * One accent highlight for every focused period — the day you picked, each day of a focused
 * week, today, the running month — so the active cell reads the same in all four views.
 * Everything else gets a red spend-heat wash scaled by how big its spend was.
 */
function paletteFor(c: PeriodCell): Palette {
  const figures = {
    net: c.outside
      ? 'var(--fp-text-3)'
      : c.netPositive
        ? 'var(--fp-accent)'
        : RED,
    inc: c.outside ? 'var(--fp-text-3)' : 'var(--fp-accent)',
    spend: c.outside ? 'var(--fp-text-3)' : RED,
  }

  if (c.isCurrent || c.isActive)
    return {
      bg: 'var(--fp-accent-soft)',
      border: '1px solid var(--fp-accent)',
      label: 'var(--fp-accent-ink)',
      ...figures,
    }

  return {
    bg: c.hasSpend
      ? `rgba(229,72,77,${(0.07 + 0.2 * c.intensity).toFixed(3)})`
      : c.hasActivity
        ? undefined
        : 'var(--fp-surface-2)',
    border: '1px solid var(--fp-border)',
    label: c.outside ? 'var(--fp-text-3)' : 'var(--fp-text-2)',
    ...figures,
  }
}

export function CalendarCell({ cell, showBreakdown, height, onPick }: Props) {
  const p = paletteFor(cell)

  return (
    <button
      type="button"
      onClick={() => onPick(cell.key)}
      className={`flex flex-col items-start justify-start gap-px overflow-hidden rounded-[9px] px-[5px] py-1 transition-[height] duration-300 md:px-[7px] ${height}`}
      style={{
        background: p.bg,
        border: p.border,
        opacity: cell.outside ? 0.5 : 1,
      }}
    >
      <span
        className="text-[10.5px] leading-[1.1] tabular-nums md:text-[12px]"
        style={{ color: p.label, fontWeight: cell.isCurrent ? 800 : 600 }}
      >
        {cell.label}
      </span>
      {cell.hasActivity ? (
        <span
          className="mt-px text-[10px] font-extrabold leading-[1.1] tabular-nums md:text-[12px]"
          style={{ color: p.net }}
        >
          {cell.netStr}
        </span>
      ) : null}
      {showBreakdown ? (
        <div className="flex items-center gap-1 leading-none">
          <span
            className="text-[8.5px] font-bold tabular-nums md:text-[10px]"
            style={{ color: p.inc }}
          >
            {cell.incStr}
          </span>
          <span
            className="text-[8.5px] font-bold tabular-nums md:text-[10px]"
            style={{ color: p.spend }}
          >
            {cell.spendStr}
          </span>
        </div>
      ) : null}
    </button>
  )
}
