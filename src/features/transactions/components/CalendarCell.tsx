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
  bg: string
  net: string
  inc: string
  spend: string
}

const POS_INK = 'var(--fp-accent-ink)'
const NEG_INK = 'var(--fp-danger)'
const MUTED_INK = 'var(--fp-text-2)'

const WASH = { pos: 'var(--fp-accent)', neg: RED }

const OUTSIDE_BG =
  'repeating-linear-gradient(135deg, var(--fp-surface) 0 5px, var(--fp-border) 5px 6px)'

/**
 * Days outside the selected period are hatched; inside it, an even day is a flat neutral
 * cell, and a day that netted positive or negative gets a green or red wash scaled by the
 * net's size. The figures use ink tokens so they stay legible on every wash in both themes.
 */
function paletteFor(c: PeriodCell): Palette {
  if (c.outside)
    return { bg: OUTSIDE_BG, net: MUTED_INK, inc: MUTED_INK, spend: MUTED_INK }

  const figures = { inc: POS_INK, spend: NEG_INK }
  if (c.tone === 'zero')
    return { bg: 'var(--fp-surface-2)', net: MUTED_INK, ...figures }

  const pct = Math.round(12 + 26 * c.intensity)
  return {
    bg: `color-mix(in srgb, ${WASH[c.tone]} ${pct}%, var(--fp-surface))`,
    net: c.tone === 'pos' ? POS_INK : NEG_INK,
    ...figures,
  }
}

/**
 * The picked day is marked by a heavy neutral border and today by an inverted date chip —
 * neither uses a colour, so neither competes with the day's green or red wash.
 */
export function CalendarCell({ cell, showBreakdown, height, onPick }: Props) {
  const p = paletteFor(cell)

  return (
    <button
      type="button"
      onClick={() => onPick(cell.key)}
      aria-pressed={cell.isActive}
      aria-current={cell.isCurrent ? 'date' : undefined}
      className={`flex flex-col items-start justify-start gap-px overflow-hidden rounded-[9px] border px-[5px] py-1 transition-[height] duration-300 md:px-[7px] ${height} ${
        cell.isActive
          ? 'border-fp-text shadow-[inset_0_0_0_1px_var(--fp-text)]'
          : 'border-fp-border'
      }`}
      style={{ background: p.bg }}
    >
      <span
        className={`text-[10.5px] leading-[1.1] font-bold tabular-nums md:text-[12px] ${
          cell.isCurrent
            ? '-ms-[3px] rounded-full bg-fp-text px-[4px] py-px text-fp-surface'
            : cell.outside
              ? 'text-fp-text-3'
              : 'text-fp-text-2'
        }`}
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
