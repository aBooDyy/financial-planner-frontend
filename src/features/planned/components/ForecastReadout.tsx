import type { ForecastDay } from '#/features/planned/data/forecast'

type Props = {
  day: ForecastDay
  /** The readout rests on the lowest day until the chart is scrubbed. */
  isLowest: boolean
}

/** The shown day's balance and what lands on it. */
export function ForecastReadout({ day, isLowest }: Props) {
  return (
    <div aria-hidden className="mb-[10px] flex flex-col gap-[3px]">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fp-text-2">
          {isLowest ? `Lowest · ${day.dateStr}` : day.dateStr}
        </span>
        <span className="fp-sensitive text-[17px] font-extrabold whitespace-nowrap tabular-nums">
          {day.balanceStr}
        </span>
      </div>
      <div className="flex min-h-[17px] items-baseline gap-2 text-[12px] text-fp-text-3">
        <span className="min-w-0 flex-1 truncate">
          {day.namesStr || 'Nothing lands'}
        </span>
        <span className="fp-sensitive font-semibold whitespace-nowrap tabular-nums">
          {day.deltaStr}
        </span>
      </div>
    </div>
  )
}
