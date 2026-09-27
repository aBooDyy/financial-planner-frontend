import type { MonthFlow } from '#/features/wallets/data/monthlyFlow'
import { cn } from '#/lib/utils'

type StatProps = { label: string; value: string; swatch: string }

function Stat({ label, value, swatch }: StatProps) {
  return (
    <span className="flex items-center gap-[6px] text-[12.5px]">
      <span
        aria-hidden
        className={cn('size-[9px] shrink-0 rounded-[3px]', swatch)}
      />
      <span className="text-fp-text-3">{label}</span>
      <span className="fp-sensitive font-bold whitespace-nowrap tabular-nums">
        {value}
      </span>
    </span>
  )
}

/** The selected month's figures; its swatches double as the chart's legend. */
export function MonthlyFlowReadout({ month }: { month: MonthFlow }) {
  return (
    <div aria-live="polite" className="mb-[14px] flex flex-col gap-[6px]">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fp-text-2">
          {month.title}
        </span>
        <span
          className={cn(
            'fp-sensitive text-[15px] font-extrabold whitespace-nowrap tabular-nums',
            month.netPositive ? 'text-fp-accent-ink' : 'text-fp-danger',
          )}
        >
          {month.netStr}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Stat label="In" value={month.inStr} swatch="bg-fp-chart-in" />
        <Stat label="Out" value={month.outStr} swatch="bg-fp-chart-out" />
      </div>
    </div>
  )
}
