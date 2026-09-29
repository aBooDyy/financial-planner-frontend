import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { BalanceStrip } from '#/features/reports/data/balances'
import { cn } from '#/lib/utils'

type Props = {
  /** Null while the balances are summed. */
  strip: BalanceStrip | null
}

/** Where the chosen accounts started and ended the period, and the change between. */
export function BalanceSummary({ strip }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px overflow-hidden rounded-[12px] border border-fp-border bg-fp-border">
      <Cell
        label="Starting balance"
        value={strip?.startStr}
        caption={strip?.startDate}
      />
      <Cell
        label={strip?.endLabel ?? 'Ending balance'}
        value={strip?.endStr}
        caption={strip?.endDate}
      />
      <Cell
        label="Change"
        value={strip?.changeStr}
        caption={strip?.note}
        valueClassName={
          strip
            ? strip.changePositive
              ? 'text-fp-accent-ink'
              : 'text-fp-danger'
            : undefined
        }
      />
    </div>
  )
}

type CellProps = {
  label: string
  value: string | undefined
  caption: string | undefined
  valueClassName?: string
}

function Cell({ label, value, caption, valueClassName }: CellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-fp-surface px-4 py-[13px]">
      <span className="text-[12px] font-bold text-fp-text-2">{label}</span>
      <span
        className={cn(
          'fp-sensitive text-[22px] font-extrabold tracking-[-0.02em] tabular-nums',
          valueClassName,
        )}
      >
        <ValueOrSkeleton value={value} className="h-6 w-28" />
      </span>
      <span className="text-[12px] font-semibold text-fp-text-3">
        <ValueOrSkeleton value={caption} className="h-3 w-24" />
      </span>
    </div>
  )
}
