import { Receipt } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { IconChip } from '#/components/icons/IconChip'
import type { LargestItem } from '#/features/reports/data/largest'
import { SkeletonRows } from '#/features/transactions/components/SkeletonRows'
import { CARD_TITLE, REPORT_CARD } from './styles'

type Props = {
  /** Null while the period's rows load. */
  items: LargestItem[] | null
  partial: boolean
}

export function LargestExpensesCard({ items, partial }: Props) {
  return (
    <div
      className={`${REPORT_CARD} flex flex-col gap-[6px] self-start px-[14px] pt-[18px] pb-[10px]`}
    >
      <div className="flex items-baseline justify-between px-[6px] pb-[6px]">
        <span className={CARD_TITLE}>Largest expenses</span>
        <span className="text-[12px] font-semibold text-fp-text-3">
          {partial ? 'so far' : 'in period'}
        </span>
      </div>
      {items === null ? (
        <SkeletonRows count={4} rowClassName="px-[6px] py-2" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          size="sm"
          title="No expenses in this period"
        />
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-[11px] rounded-[10px] px-[6px] py-2"
          >
            <IconChip
              id={item.icon}
              color={item.color}
              size={32}
              iconSize={16}
            />
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className="truncate text-[13.5px] font-bold">
                {item.title}
              </span>
              <span className="text-[12px] text-fp-text-3">{item.sub}</span>
            </span>
            <span className="fp-sensitive text-[13.5px] font-extrabold tabular-nums">
              {item.amountStr}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
