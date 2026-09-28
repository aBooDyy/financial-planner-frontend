import type { CategoryOption } from '#/features/search/data/filterOptions'
import type { SearchFilters } from '#/features/search/data/types'

export type RootPicks = {
  root: CategoryOption
  /** Picked whole. */
  whole: boolean
  /** How many of its children are picked on their own. */
  picked: number
  on: boolean
}

/** How much of one root category the filters hold. */
export function rootPicks(
  root: CategoryOption,
  filters: SearchFilters,
): RootPicks {
  const whole = filters.categoryIds.includes(root.id)
  const picked = root.subs.filter((s) =>
    filters.subcategoryIds.includes(s.id),
  ).length
  return { root, whole, picked, on: whole || picked > 0 }
}
