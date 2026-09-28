import type { SearchFilters } from '#/features/search/data/types'
import type { RootPicks } from './rootPicks'
import { SearchChip } from './SearchChip'

type Props = {
  picks: ReadonlyArray<RootPicks>
  filters: SearchFilters
  onPickWhole: (rootId: string) => void
  onToggleSub: (subId: string) => void
}

/** Per picked root, "All" or any of its children. */
export function SubcategoryRows({
  picks,
  filters,
  onPickWhole,
  onToggleSub,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-fp-border bg-fp-surface px-3 py-[10px]">
      {picks.map(({ root, whole }) => (
        <div
          key={root.id}
          role="group"
          aria-label={`${root.name} subcategories`}
          className="flex flex-wrap items-start gap-2"
        >
          <span
            className="py-1 text-[12px] font-bold whitespace-nowrap"
            style={{ color: root.color }}
          >
            {root.name} ›
          </span>
          <SearchChip
            size="sm"
            color={root.color}
            active={whole}
            onClick={() => onPickWhole(root.id)}
          >
            All
          </SearchChip>
          {root.subs.map((sub) => (
            <SearchChip
              key={sub.id}
              size="sm"
              color={root.color}
              active={!whole && filters.subcategoryIds.includes(sub.id)}
              onClick={() => onToggleSub(sub.id)}
            >
              {sub.name}
            </SearchChip>
          ))}
        </div>
      ))}
    </div>
  )
}
