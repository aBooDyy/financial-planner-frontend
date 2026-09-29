import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { Readout } from '#/features/reports/data/trend'
import { cn } from '#/lib/utils'

type Props = {
  /** Null while the period's rows load. */
  readout: Readout | null
  /** Heads the readout before it has loaded. */
  fallbackTitle: string
}

/** The figures for the whole period, or for the column being pointed at. */
export function TrendReadout({ readout, fallbackTitle }: Props) {
  const items: { label: string; value: ReactNode; className?: string }[] = [
    {
      label: 'Income',
      value: readout?.incomeStr,
      className: 'text-fp-accent-ink',
    },
    { label: 'Spending', value: readout?.spendingStr },
    {
      label: 'Net',
      value: readout?.netStr,
      className: readout
        ? readout.netPositive
          ? 'text-fp-accent-ink'
          : 'text-fp-danger'
        : undefined,
    },
    ...(readout?.balance
      ? [
          {
            label: 'Balance',
            value: (
              <span className="inline-flex items-baseline gap-[5px]">
                {readout.balance.startStr}
                <ArrowRight
                  aria-label="to"
                  size={12}
                  strokeWidth={2.4}
                  className="self-center text-fp-text-3 rtl:-scale-x-100"
                />
                {readout.balance.endStr}
              </span>
            ),
          },
        ]
      : []),
  ]
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-baseline gap-x-[18px] gap-y-[6px] rounded-[11px] bg-fp-surface-2 px-3 py-[10px]"
    >
      <span className="text-[12.5px] font-bold">
        {readout?.title ?? fallbackTitle}
      </span>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-baseline gap-[6px] text-[12.5px]"
        >
          <span className="text-fp-text-2">{item.label}</span>
          <span
            className={cn(
              'fp-sensitive font-extrabold tabular-nums',
              item.className,
            )}
          >
            <ValueOrSkeleton value={item.value} className="h-3 w-16" />
          </span>
        </span>
      ))}
    </div>
  )
}
