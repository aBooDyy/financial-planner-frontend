import { ChevronRight, ListIcon } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import type {
  CategoryItem,
  SubcategoryItem,
} from '#/features/reports/data/breakdown'
import { DeltaText } from './DeltaText'

type Props = {
  item: CategoryItem
  expanded: boolean
  onToggle: () => void
  /** Shows the transactions behind the whole category (null) or one of its subcategories. */
  onViewTransactions: (subId: string | null) => void
}

/** One category: its share bar and change; opens onto the subcategories beneath it. */
export function CategoryRow({
  item,
  expanded,
  onToggle,
  onViewTransactions,
}: Props) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-2 py-[9px] text-start hover:bg-fp-surface-2"
      >
        <IconChip id={item.icon} color={item.color} size={32} iconSize={16} />
        <span className="flex min-w-0 flex-col gap-[7px]">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-bold">{item.name}</span>
            <span className="text-[12px] font-semibold text-fp-text-3">
              {item.shareStr}
            </span>
          </span>
          <ShareBar
            pct={item.barPct}
            color={item.color}
            className="h-[6px] bg-fp-surface-2"
          />
        </span>
        <span className="flex min-w-[84px] flex-col items-end gap-[3px]">
          <span className="fp-sensitive text-[14px] font-extrabold tabular-nums">
            {item.amountStr}
          </span>
          {item.delta ? (
            <DeltaText delta={item.delta} className="text-[12px]" />
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="ms-[52px] me-2 mb-2 flex flex-col gap-[5px] rounded-[12px] bg-fp-surface-2 px-[14px] py-3">
          <div className="flex items-center gap-2">
            <span className="fp-sensitive min-w-0 flex-1 text-[12px] font-semibold text-fp-text-2">
              {item.detail}
            </span>
            <button
              type="button"
              onClick={() => onViewTransactions(null)}
              className="flex flex-none items-center gap-[5px] rounded-[9px] border border-fp-border bg-fp-surface px-[9px] py-[5px] text-[12px] font-bold text-fp-text hover:bg-fp-bg focus-visible:ring-[3px] focus-visible:ring-fp-accent/30 focus-visible:outline-none"
            >
              <ListIcon size={13} strokeWidth={2.2} />
              View all
            </button>
          </div>
          <div className="-mx-2 flex flex-col">
            {item.subs.map((sub) => (
              <SubcategoryRow
                key={sub.id}
                sub={sub}
                color={item.color}
                onClick={() => onViewTransactions(sub.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SubcategoryRow({
  sub,
  color,
  onClick,
}: {
  sub: SubcategoryItem
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(0,1fr)_38px_auto_14px] items-center gap-3 rounded-[10px] px-2 py-[6px] text-start hover:bg-fp-surface focus-visible:ring-[3px] focus-visible:ring-fp-accent/30 focus-visible:outline-none"
    >
      <span className="flex min-w-0 flex-col gap-[6px]">
        <span className="truncate text-[13px] font-semibold">
          {sub.name}
          <span className="sr-only">, view transactions</span>
        </span>
        <ShareBar pct={sub.barPct} color={color} className="h-1 bg-fp-border" />
      </span>
      <span className="text-end text-[12px] font-semibold text-fp-text-3">
        {sub.shareStr}
      </span>
      <span className="flex min-w-[80px] flex-col items-end gap-[2px]">
        <span className="fp-sensitive text-[13px] font-bold tabular-nums">
          {sub.amountStr}
        </span>
        {sub.delta ? (
          <DeltaText delta={sub.delta} className="text-[11.5px]" />
        ) : null}
      </span>
      <ChevronRight
        aria-hidden
        size={14}
        strokeWidth={2.2}
        className="text-fp-text-3 rtl:-scale-x-100"
      />
    </button>
  )
}

type ShareBarProps = { pct: number; color: string; className: string }

function ShareBar({ pct, color, className }: ShareBarProps) {
  return (
    <span
      aria-hidden
      className={`block overflow-hidden rounded-full ${className}`}
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  )
}
