import { useState } from 'react'
import { PieChart } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { CategoryBreakdown } from '#/features/reports/data/breakdown'
import type { CategoryPick } from '#/features/reports/data/categoryTxns'
import type { TxType } from '#/features/transactions/api/types'
import { SkeletonRows } from '#/features/transactions/components/SkeletonRows'
import { CategoryRow } from './CategoryRow'
import { CARD_TITLE, REPORT_CARD } from './styles'

type Props = {
  /** Null while the period's rows load. */
  breakdown: Record<TxType, CategoryBreakdown> | null
  onViewTransactions: (pick: CategoryPick) => void
}

const TYPES: { value: TxType; label: string }[] = [
  { value: 'spend', label: 'Spending' },
  { value: 'income', label: 'Income' },
]

const EMPTY_TITLE: Record<TxType, string> = {
  spend: 'Nothing spent in this period',
  income: 'No income in this period',
}

export function CategoryBreakdownCard({
  breakdown,
  onViewTransactions,
}: Props) {
  const [type, setType] = useState<TxType>('spend')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const shown = breakdown?.[type] ?? null

  return (
    <div
      className={`${REPORT_CARD} flex flex-col gap-3 px-[14px] pt-[18px] pb-3`}
    >
      <div className="flex flex-wrap items-center gap-[10px] px-[6px]">
        <span className={CARD_TITLE}>By category</span>
        <ToggleGroup
          type="single"
          value={type}
          onValueChange={(v) => {
            if (v === 'spend' || v === 'income') setType(v)
          }}
          className="rounded-[10px] bg-fp-surface-2 p-[3px]"
        >
          {TYPES.map((t) => (
            <ToggleGroupItem
              key={t.value}
              value={t.value}
              className="h-auto rounded-[8px] px-[10px] py-[5px] text-[12.5px] font-semibold text-fp-text-2 hover:bg-transparent hover:text-fp-text data-[state=on]:bg-fp-surface data-[state=on]:font-bold data-[state=on]:text-fp-text data-[state=on]:shadow-[0_1px_2px_rgba(20,18,12,0.10)]"
            >
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex-1" />
        <span className="fp-sensitive text-[13px] font-semibold text-fp-text-2">
          <ValueOrSkeleton value={shown?.totalStr} className="h-3.5 w-24" />
        </span>
      </div>

      {shown === null ? (
        <SkeletonRows count={5} rowClassName="px-2 py-[9px]" />
      ) : shown.items.length === 0 ? (
        <EmptyState icon={PieChart} size="sm" title={EMPTY_TITLE[type]} />
      ) : (
        <div className="flex flex-col">
          {shown.items.map((item) => (
            <CategoryRow
              key={item.id}
              item={item}
              expanded={item.id === expandedId}
              onToggle={() =>
                setExpandedId((id) => (id === item.id ? null : item.id))
              }
              onViewTransactions={(subId) =>
                onViewTransactions({ type, rootId: item.id, subId })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
