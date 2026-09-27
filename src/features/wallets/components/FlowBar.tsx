import { cn } from '#/lib/utils'

type Props = {
  /** Height against the chart's tallest bar, 0–100. */
  pct: number
  className: string
}

/** One column of the in/out chart: rounded at its data end, square on the baseline. */
export function FlowBar({ pct, className }: Props) {
  return (
    <div
      className={cn('w-[10px] rounded-t-[4px]', className)}
      style={{ height: pct > 0 ? `max(${pct}%, 2px)` : 0 }}
    />
  )
}
