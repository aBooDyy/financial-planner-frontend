import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { SummaryStat, SummaryView } from '#/features/reports/data/summary'
import { cn } from '#/lib/utils'
import { DeltaText } from './DeltaText'
import { REPORT_CARD } from './styles'

type Props = {
  /** Null while the period's rows load. */
  view: SummaryView | null
}

/** Income, spending and net; on mobile net leads, full width, above the other two. */
export function SummaryCards({ view }: Props) {
  const net = view?.net
  return (
    <div className="grid grid-cols-2 gap-[10px] md:grid-cols-3 md:gap-[14px]">
      <SummaryCard
        label="Income"
        swatch="bg-fp-chart-in"
        stat={view?.income}
        vs={view?.vs}
      />
      <SummaryCard
        label="Spending"
        swatch="bg-fp-chart-out"
        stat={view?.spending}
        vs={view?.vs}
      />
      <SummaryCard
        label={net?.label ?? 'Net'}
        swatch={net && !net.positive ? 'bg-fp-danger' : 'bg-fp-accent'}
        amountClassName={
          net
            ? net.positive
              ? 'text-fp-accent-ink'
              : 'text-fp-danger'
            : undefined
        }
        stat={net}
        vs={view?.vs}
        lead
      />
    </div>
  )
}

type CardProps = {
  label: string
  swatch: string
  stat: SummaryStat | undefined
  vs: string | null | undefined
  /** The net card: first and full width on mobile, larger figure. */
  lead?: boolean
  amountClassName?: string
}

function SummaryCard({
  label,
  swatch,
  stat,
  vs,
  lead = false,
  amountClassName,
}: CardProps) {
  return (
    <div
      className={cn(
        REPORT_CARD,
        'flex flex-col gap-2 px-[15px] py-[14px] md:px-5 md:py-[18px]',
        lead && 'order-first col-span-2 md:order-none md:col-span-1',
      )}
    >
      <div className="flex items-center gap-[7px] text-[12.5px] font-bold text-fp-text-2">
        <span
          aria-hidden
          className={cn('size-2 flex-none rounded-[3px]', swatch)}
        />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'fp-sensitive leading-[1.1] font-extrabold tracking-[-0.03em] tabular-nums md:text-[28px]',
          lead ? 'text-[30px]' : 'text-[21px]',
          amountClassName,
        )}
      >
        <ValueOrSkeleton value={stat?.amountStr} className="h-7 w-32" />
      </div>
      {stat === undefined ? (
        <ValueOrSkeleton value={null} className="h-3.5 w-40" />
      ) : stat.delta ? (
        <div className="flex flex-wrap items-center gap-x-[6px] text-[12.5px]">
          <DeltaText delta={stat.delta} className="fp-sensitive" />
          <span className="font-medium text-fp-text-3">{vs}</span>
        </div>
      ) : null}
    </div>
  )
}
