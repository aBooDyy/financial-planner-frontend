import { useMemo } from 'react'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import {
  pickWholeCategory,
  toggleCategory,
  toggleSubcategory,
  toggleWallet,
} from '#/features/search/data/filters'
import type { SearchFilters } from '#/features/search/data/types'
import { useSearchStore } from '#/features/search/stores/search'

/** The filter panel's edits, bound to the sheet's store. */
export function useSearchFilterActions() {
  const setFilters = useSearchStore((s) => s.setFilters)
  const clear = useSearchStore((s) => s.clearFilters)
  const catalog = useCategoryCatalog()

  return useMemo(
    () => ({
      patch: (patch: Partial<SearchFilters>) => setFilters(patch),
      // A chip showing some of its children is on, so tapping it clears them too.
      toggleRoot: (rootId: string) =>
        setFilters((f) => {
          const partial =
            !f.categoryIds.includes(rootId) &&
            catalog.subsOf(rootId).some((s) => f.subcategoryIds.includes(s.id))
          const whole = partial ? pickWholeCategory(f, rootId, catalog) : f
          return toggleCategory(whole, rootId, catalog)
        }),
      pickWhole: (rootId: string) =>
        setFilters((f) => pickWholeCategory(f, rootId, catalog)),
      toggleSub: (subId: string) =>
        setFilters((f) => toggleSubcategory(f, subId, catalog)),
      toggleWallet: (walletId: string) =>
        setFilters((f) => toggleWallet(f, walletId)),
      clear,
    }),
    [setFilters, clear, catalog],
  )
}
