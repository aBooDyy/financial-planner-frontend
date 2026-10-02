import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import type { NwsCategory } from '#/features/reports/data/needsWantsCard'
import { cn } from '#/lib/utils'

type Props = {
  label: string
  fill: string
  amountStr: string
  pctStr: string | null
  /** The line under the figures: guideline, verdict, comparison, note. */
  detail: ReactNode
  /** Beside the detail, outside the toggle — e.g. "Sort 2 categories". */
  action?: ReactNode
  categories: NwsCategory[]
  expanded: boolean
  onToggle: () => void
  onViewCategory: (rootId: string) => void
}

/** One bucket of the split; opens onto the categories behind it. */
export function NeedsWantsRow({
  label,
  fill,
  amountStr,
  pctStr,
  detail,
  action,
  categories,
  expanded,
  onToggle,
  onViewCategory,
}: Props) {
  const canOpen = categories.length > 0
  return (
    <div>
      <div className="flex items-start gap-2 rounded-[12px] px-2 py-[9px] hover:bg-fp-surface-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={!canOpen}
          aria-expanded={canOpen ? expanded : undefined}
          className="flex min-w-0 flex-1 flex-col gap-[3px] text-start outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30 disabled:cursor-default"
        >
          <span className="flex w-full items-center gap-[9px]">
            <span
              aria-hidden
              className={cn('size-[10px] flex-none rounded-[3px]', fill)}
            />
            <span className="truncate text-[14px] font-bold">{label}</span>
            <span className="flex-1" />
            <span className="fp-sensitive text-[14px] font-extrabold tabular-nums">
              {amountStr}
            </span>
            <span className="min-w-[40px] text-end text-[14px] font-extrabold tabular-nums">
              {pctStr ?? '–'}
            </span>
            {canOpen ? (
              <ChevronDown
                aria-hidden
                size={14}
                strokeWidth={2.2}
                className={cn(
                  'flex-none text-fp-text-3 transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            ) : (
              <span aria-hidden className="w-[14px] flex-none" />
            )}
          </span>
          <span className="ps-[19px] text-[12px] font-semibold text-fp-text-3">
            {detail}
          </span>
        </button>
        {action}
      </div>
      {expanded && canOpen ? (
        <div className="ms-[27px] me-2 mb-2 flex flex-col rounded-[12px] bg-fp-surface-2 px-[6px] py-[6px]">
          {categories.map((c) => (
            <button
              key={c.rootId}
              type="button"
              onClick={() => onViewCategory(c.rootId)}
              className="grid w-full grid-cols-[26px_minmax(0,1fr)_38px_auto_14px] items-center gap-[10px] rounded-[10px] px-2 py-[6px] text-start hover:bg-fp-surface focus-visible:ring-[3px] focus-visible:ring-fp-accent/30 focus-visible:outline-none"
            >
              <IconChip id={c.icon} color={c.color} size={26} iconSize={13} />
              <span className="truncate text-[13px] font-semibold">
                {c.name}
                <span className="sr-only">, view transactions</span>
              </span>
              <span className="text-end text-[12px] font-semibold text-fp-text-3">
                {c.shareStr}
              </span>
              <span className="fp-sensitive text-end text-[13px] font-bold tabular-nums">
                {c.amountStr}
              </span>
              <ChevronRight
                aria-hidden
                size={14}
                strokeWidth={2.2}
                className="text-fp-text-3 rtl:-scale-x-100"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
