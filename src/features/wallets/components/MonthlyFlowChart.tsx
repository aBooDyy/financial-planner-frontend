import type { MonthFlow } from '#/features/wallets/data/monthlyFlow'
import { cn } from '#/lib/utils'
import { FlowBar } from './FlowBar'

type Props = {
  months: MonthFlow[]
  scaleStr: string
  selectedKey: string
  onSelect: (key: string) => void
  /** Hover left the chart: fall back to the default month. */
  onLeave: () => void
}

/**
 * Paired in/out columns per month. Each month is one button — hover, focus or tap puts its
 * figures in the readout above — so the hit target is the whole column, not the thin bars.
 */
export function MonthlyFlowChart({
  months,
  scaleStr,
  selectedKey,
  onSelect,
  onLeave,
}: Props) {
  return (
    <div>
      <div className="fp-sensitive mb-1 text-end text-[10.5px] text-fp-text-3 tabular-nums">
        {scaleStr}
      </div>
      <div
        className="flex border-t border-fp-border"
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') onLeave()
        }}
      >
        {months.map((m) => {
          const selected = m.key === selectedKey
          return (
            <button
              key={m.key}
              type="button"
              aria-label={m.ariaLabel}
              aria-pressed={selected}
              className={cn(
                'flex flex-1 cursor-pointer flex-col items-center rounded-b-[8px] outline-none focus-visible:ring-2 focus-visible:ring-fp-accent',
                selected && 'bg-fp-surface-2',
              )}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') onSelect(m.key)
              }}
              onFocus={() => onSelect(m.key)}
              onClick={() => onSelect(m.key)}
            >
              <div className="flex h-[88px] w-full items-end justify-center gap-[2px] border-b border-fp-border pt-[6px]">
                <FlowBar pct={m.inPct} className="bg-fp-chart-in" />
                <FlowBar pct={m.outPct} className="bg-fp-chart-out" />
              </div>
              <span
                className={cn(
                  'py-[6px] text-[11px]',
                  selected
                    ? 'font-bold text-fp-text'
                    : 'font-medium text-fp-text-3',
                )}
              >
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
