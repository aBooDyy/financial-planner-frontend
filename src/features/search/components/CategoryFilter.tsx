import { ChevronDown } from 'lucide-react'
import { Icon } from '#/components/icons/Icon'
import { iconIdOr, SPEND_CATEGORY_ICON } from '#/lib/icons/fallbacks'
import { cn } from '#/lib/utils'
import type { CategoryOption } from '#/features/search/data/filterOptions'
import type { SearchFilters } from '#/features/search/data/types'
import { rootPicks } from './rootPicks'
import { FilterSection } from './FilterSection'
import { SearchChip } from './SearchChip'
import { SubcategoryRows } from './SubcategoryRows'

type Props = {
  roots: ReadonlyArray<CategoryOption>
  filters: SearchFilters
  subcategoriesOpen: boolean
  onToggleSubcategoriesOpen: () => void
  onToggleRoot: (rootId: string) => void
  onPickWhole: (rootId: string) => void
  onToggleSub: (subId: string) => void
}

export function CategoryFilter({
  roots,
  filters,
  subcategoriesOpen,
  onToggleSubcategoriesOpen,
  onToggleRoot,
  onPickWhole,
  onToggleSub,
}: Props) {
  const picks = roots.map((root) => rootPicks(root, filters))
  const refinable = picks.filter((p) => p.on && p.root.subs.length > 0)
  const subCount = filters.subcategoryIds.length

  return (
    <FilterSection label="Category">
      <div className="flex flex-wrap gap-[6px]">
        {picks.map(({ root, on, whole, picked }) => (
          <SearchChip
            key={root.id}
            active={on}
            onClick={() => onToggleRoot(root.id)}
          >
            <Icon
              id={iconIdOr(root.iconId, SPEND_CATEGORY_ICON)}
              size={13}
              className="flex-none"
            />
            <span className="truncate">
              {root.name}
              {on && !whole ? ` · ${picked}` : ''}
            </span>
          </SearchChip>
        ))}
      </div>
      {refinable.length > 0 ? (
        <button
          type="button"
          onClick={onToggleSubcategoriesOpen}
          aria-expanded={subcategoriesOpen}
          className="inline-flex items-center gap-[5px] self-start px-[2px] py-1 text-[12.5px] font-bold text-fp-accent-ink"
        >
          <span>
            {subcategoriesOpen ? 'Hide subcategories' : 'Refine by subcategory'}
            {subCount > 0 ? ` · ${subCount} selected` : ''}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            aria-hidden
            className={cn(
              'flex-none transition-transform',
              subcategoriesOpen && 'rotate-180',
            )}
          />
        </button>
      ) : null}
      {refinable.length > 0 && subcategoriesOpen ? (
        <SubcategoryRows
          picks={refinable}
          filters={filters}
          onPickWhole={onPickWhole}
          onToggleSub={onToggleSub}
        />
      ) : null}
    </FilterSection>
  )
}
