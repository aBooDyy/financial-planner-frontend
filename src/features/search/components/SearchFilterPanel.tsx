import { usePreferencesStore } from '#/stores/preferences'
import { useSearchFilterActions } from '#/features/search/hooks/useSearchFilterActions'
import type { SearchFilterOptions } from '#/features/search/hooks/useSearchFilterOptions'
import { useSearchStore } from '#/features/search/stores/search'
import { AccountFilter } from './AccountFilter'
import { AmountFilter } from './AmountFilter'
import { CategoryFilter } from './CategoryFilter'
import { DateFilter } from './DateFilter'
import { FilterPanelFooter } from './FilterPanelFooter'
import { TypeFilter } from './TypeFilter'

type Props = {
  options: SearchFilterOptions
  /** Matches for the current search; null while nothing is being searched. */
  total: number | null
}

/** Type, date, category, accounts and amount, over the results. */
export function SearchFilterPanel({ options, total }: Props) {
  const filters = useSearchStore((s) => s.filters)
  const subcategoriesOpen = useSearchStore((s) => s.subcategoriesOpen)
  const toggleSubcategoriesOpen = useSearchStore(
    (s) => s.toggleSubcategoriesOpen,
  )
  const toggleFiltersOpen = useSearchStore((s) => s.toggleFiltersOpen)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const edit = useSearchFilterActions()

  return (
    <div className="flex flex-col gap-4 border-b border-fp-border bg-fp-surface-2 p-4">
      <TypeFilter
        value={filters.type}
        onChange={(type) => edit.patch({ type })}
      />
      <DateFilter
        filters={filters}
        dateFormat={dateFormat}
        onChange={edit.patch}
      />
      <CategoryFilter
        roots={options.roots}
        filters={filters}
        subcategoriesOpen={subcategoriesOpen}
        onToggleSubcategoriesOpen={toggleSubcategoriesOpen}
        onToggleRoot={edit.toggleRoot}
        onPickWhole={edit.pickWhole}
        onToggleSub={edit.toggleSub}
      />
      <AccountFilter
        wallets={options.wallets}
        picked={filters.walletIds}
        onToggle={edit.toggleWallet}
      />
      <AmountFilter
        min={filters.min}
        max={filters.max}
        symbol={options.baseSymbol}
        onChange={edit.patch}
      />
      <FilterPanelFooter
        total={total}
        onClear={edit.clear}
        onDone={toggleFiltersOpen}
      />
    </div>
  )
}
