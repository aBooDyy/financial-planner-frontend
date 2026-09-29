import type { GridLine, TrendColumn } from '#/features/reports/data/trend'
import { cn } from '#/lib/utils'

type Props = {
  columns: TrendColumn[]
  grid: GridLine[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
}

/** Columns past which every other label is dropped: on mobile, and on every screen. */
const THIN_MOBILE = 8
const THIN_ALL = 16

function barWidth(count: number): string {
  if (count > 14) return 'w-full md:w-[42%]'
  if (count > 8) return 'w-[38%]'
  return 'w-[30%]'
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div
      className={cn('max-w-[22px] rounded-[4px_4px_1px_1px]', className)}
      style={{ height: pct > 0 ? `max(${pct}%, 2px)` : 0 }}
    />
  )
}

/**
 * Paired income and spending columns per day, week or month over a scale of three lines.
 * Each column is one button — hover, focus or tap reads it out — so the hit target is the
 * whole column, not the thin bars.
 */
export function TrendChart({ columns, grid, selectedKey, onSelect }: Props) {
  const width = barWidth(columns.length)
  return (
    <div
      className="relative ps-10"
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') onSelect(null)
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[200px]"
      >
        {grid.map((g) => (
          <div
            key={g.pct}
            className={cn(
              'absolute inset-x-0 border-t',
              g.pct === 0
                ? 'border-solid border-fp-border-strong'
                : 'border-dashed border-fp-border',
            )}
            style={{ top: `${100 - g.pct}%` }}
          >
            <span className="fp-sensitive absolute -top-2 start-0 text-[11px] font-semibold text-fp-text-3">
              {g.label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative flex gap-[2px] md:gap-[6px]">
        {columns.map((c, i) => {
          const selected = c.key === selectedKey
          const thin =
            i % 2 === 1
              ? columns.length > THIN_ALL
                ? 'invisible'
                : columns.length > THIN_MOBILE
                  ? 'max-md:invisible'
                  : ''
              : ''
          return (
            <button
              key={c.key}
              type="button"
              disabled={c.future}
              aria-pressed={selected}
              aria-label={
                c.readout
                  ? `${c.readout.title}: income ${c.readout.incomeStr}, spending ${c.readout.spendingStr}`
                  : c.label
              }
              className="flex min-w-0 flex-1 flex-col gap-[6px] outline-none focus-visible:[&>div]:ring-2 focus-visible:[&>div]:ring-fp-accent"
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse' && !c.future) onSelect(c.key)
              }}
              onFocus={() => onSelect(c.key)}
              onClick={() => onSelect(selected ? null : c.key)}
            >
              <div
                className={cn(
                  'relative flex h-[200px] w-full items-end justify-center gap-[3px] rounded-t-[8px]',
                  selected && 'bg-fp-text/[0.045]',
                  c.future && 'opacity-40',
                )}
              >
                <Bar
                  pct={c.incomePct}
                  className={cn(width, 'bg-fp-chart-in')}
                />
                <Bar
                  pct={c.spendingPct}
                  className={cn(width, 'bg-fp-chart-out')}
                />
              </div>
              <span
                className={cn(
                  'h-[14px] text-center text-[11px] whitespace-nowrap',
                  c.future
                    ? 'font-semibold text-fp-border-strong'
                    : selected
                      ? 'font-extrabold text-fp-text'
                      : 'font-semibold text-fp-text-3',
                  thin,
                )}
              >
                {c.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
