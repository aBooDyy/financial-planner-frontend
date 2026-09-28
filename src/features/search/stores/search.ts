import { create } from 'zustand'
import { EMPTY_SEARCH_FILTERS } from '#/features/search/data/types'
import type { SearchContext, SearchFilters } from '#/features/search/data/types'

type FiltersUpdate =
  | Partial<SearchFilters>
  | ((filters: SearchFilters) => SearchFilters)

type SearchState = {
  open: boolean
  query: string
  /** Everywhere; false narrows to `context`. */
  wide: boolean
  filters: SearchFilters
  filtersOpen: boolean
  subcategoriesOpen: boolean
  /** The Spending tab and scope on screen, while that page is. */
  context: SearchContext | null
  openSearch: () => void
  closeSearch: () => void
  setQuery: (query: string) => void
  setWide: (wide: boolean) => void
  setFilters: (update: FiltersUpdate) => void
  clearFilters: () => void
  toggleFiltersOpen: () => void
  toggleSubcategoriesOpen: () => void
  setContext: (context: SearchContext | null) => void
}

const CLOSED = {
  open: false,
  query: '',
  wide: true,
  filters: EMPTY_SEARCH_FILTERS,
  filtersOpen: false,
  subcategoriesOpen: false,
}

/** The app-wide search sheet. In memory only: every opening starts fresh. */
export const useSearchStore = create<SearchState>((set) => ({
  ...CLOSED,
  context: null,
  openSearch: () => set({ open: true }),
  closeSearch: () => set(CLOSED),
  setQuery: (query) => set({ query }),
  setWide: (wide) => set({ wide }),
  setFilters: (update) =>
    set((s) => ({
      filters:
        typeof update === 'function'
          ? update(s.filters)
          : { ...s.filters, ...update },
    })),
  clearFilters: () => set({ filters: EMPTY_SEARCH_FILTERS }),
  toggleFiltersOpen: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  toggleSubcategoriesOpen: () =>
    set((s) => ({ subcategoriesOpen: !s.subcategoriesOpen })),
  setContext: (context) => set({ context }),
}))
