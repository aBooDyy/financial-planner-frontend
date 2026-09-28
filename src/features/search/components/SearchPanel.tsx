import { filterCount } from '#/features/search/data/filters'
import { useOpenSearchTarget } from '#/features/search/hooks/useOpenSearchTarget'
import { useSearchFilterOptions } from '#/features/search/hooks/useSearchFilterOptions'
import { useSearchView } from '#/features/search/hooks/useSearchView'
import { useSearchStore } from '#/features/search/stores/search'
import { ActiveFilterChips } from './ActiveFilterChips'
import { SearchFilterPanel } from './SearchFilterPanel'
import { SearchFiltersButton } from './SearchFiltersButton'
import { SearchInputRow } from './SearchInputRow'
import { SearchResults } from './SearchResults'
import { SearchScopeChips } from './SearchScopeChips'

/** The sheet's contents. Mounted only while it is open, so nothing is read while shut. */
export function SearchPanel() {
  const query = useSearchStore((s) => s.query)
  const wide = useSearchStore((s) => s.wide)
  const filters = useSearchStore((s) => s.filters)
  const filtersOpen = useSearchStore((s) => s.filtersOpen)
  const context = useSearchStore((s) => s.context)
  const setQuery = useSearchStore((s) => s.setQuery)
  const setWide = useSearchStore((s) => s.setWide)
  const setFilters = useSearchStore((s) => s.setFilters)
  const clearFilters = useSearchStore((s) => s.clearFilters)
  const toggleFiltersOpen = useSearchStore((s) => s.toggleFiltersOpen)
  const closeSearch = useSearchStore((s) => s.closeSearch)
  const openTarget = useOpenSearchTarget()

  const everywhere = wide || context === null
  const { view } = useSearchView({
    query,
    filters,
    wide: everywhere,
    context,
    enabled: true,
  })
  const options = useSearchFilterOptions(filters, true)
  const total = view && !view.idle ? view.total : null

  return (
    <>
      <SearchInputRow query={query} onQuery={setQuery} onCancel={closeSearch} />
      <div className="flex flex-none flex-col gap-[10px] border-b border-fp-border px-4 py-3">
        <SearchScopeChips
          context={context}
          wide={everywhere}
          onWide={setWide}
          trailing={
            <SearchFiltersButton
              open={filtersOpen}
              count={filterCount(filters)}
              onToggle={toggleFiltersOpen}
            />
          }
        />
        {!filtersOpen && options.chips.length > 0 ? (
          <ActiveFilterChips
            chips={options.chips}
            onRemove={(chip) => setFilters(chip.remove)}
            onClear={clearFilters}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {filtersOpen ? (
          <SearchFilterPanel options={options} total={total} />
        ) : null}
        {view ? (
          <SearchResults
            view={view}
            onOpen={(row) => openTarget(row.target)}
            onWiden={() => setWide(true)}
          />
        ) : null}
      </div>
    </>
  )
}
