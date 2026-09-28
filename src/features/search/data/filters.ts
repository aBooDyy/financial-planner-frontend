import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { addDays, parseISO, ymd } from '#/features/transactions/data/planning'
import type { SearchFilters } from './types'

/** Inclusive ISO bounds; a null side is open. */
export type DateBounds = { from: string | null; to: string | null }

/** Base-currency major bounds; a null side is open. */
export type AmountBounds = { min: number | null; max: number | null }

const parseMajor = (typed: string): number | null => {
  const cleaned = typed.replace(/[\s,]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export const amountBounds = (f: SearchFilters): AmountBounds => ({
  min: parseMajor(f.min),
  max: parseMajor(f.max),
})

export const amountActive = (f: SearchFilters): boolean => {
  const { min, max } = amountBounds(f)
  return min !== null || max !== null
}

/** A custom range with both sides open filters nothing, so it does not count as set. */
export const dateActive = (f: SearchFilters): boolean =>
  f.date === 'custom' ? f.from !== '' || f.to !== '' : f.date !== 'any'

/** The dates the filter keeps, relative to `today` (ISO); null when no date filter is set. */
export function dateBounds(f: SearchFilters, today: string): DateBounds | null {
  if (!dateActive(f)) return null
  const now = parseISO(today)
  switch (f.date) {
    case 'month':
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    case '30':
    case '90':
      return { from: ymd(addDays(now, 1 - Number(f.date))), to: today }
    default:
      return { from: f.from || null, to: f.to || null }
  }
}

export const filterCount = (f: SearchFilters): number =>
  (f.type !== 'any' ? 1 : 0) +
  (dateActive(f) ? 1 : 0) +
  f.categoryIds.length +
  f.subcategoryIds.length +
  f.walletIds.length +
  (amountActive(f) ? 1 : 0)

export const hasActiveFilters = (f: SearchFilters): boolean =>
  filterCount(f) > 0

const toggled = (ids: ReadonlyArray<string>, id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

const without = (
  ids: ReadonlyArray<string>,
  drop: ReadonlyArray<string>,
): string[] => ids.filter((id) => !drop.includes(id))

const childIds = (catalog: CategoryCatalog, rootId: string): string[] =>
  catalog.subsOf(rootId).map((s) => s.id)

/** Picks or unpicks a whole root; either way none of its children stays picked alone. */
export function toggleCategory(
  f: SearchFilters,
  rootId: string,
  catalog: CategoryCatalog,
): SearchFilters {
  return {
    ...f,
    categoryIds: toggled(f.categoryIds, rootId),
    subcategoryIds: without(f.subcategoryIds, childIds(catalog, rootId)),
  }
}

/** The "All" chip under a root: the root whole, in place of any children picked alone. */
export function pickWholeCategory(
  f: SearchFilters,
  rootId: string,
  catalog: CategoryCatalog,
): SearchFilters {
  return {
    ...f,
    categoryIds: f.categoryIds.includes(rootId)
      ? f.categoryIds
      : [...f.categoryIds, rootId],
    subcategoryIds: without(f.subcategoryIds, childIds(catalog, rootId)),
  }
}

/**
 * Toggles one child. Unticking a child of a root picked whole keeps its siblings; ticking the
 * last missing sibling collapses them back into the root.
 */
export function toggleSubcategory(
  f: SearchFilters,
  subId: string,
  catalog: CategoryCatalog,
): SearchFilters {
  const root = catalog.parentOf(subId)
  if (!root) return toggleCategory(f, subId, catalog)
  const siblings = childIds(catalog, root.id)

  if (f.categoryIds.includes(root.id)) {
    return {
      ...f,
      categoryIds: f.categoryIds.filter((id) => id !== root.id),
      subcategoryIds: [
        ...without(f.subcategoryIds, siblings),
        ...siblings.filter((id) => id !== subId),
      ],
    }
  }

  const subs = toggled(f.subcategoryIds, subId)
  if (siblings.every((id) => subs.includes(id)))
    return {
      ...f,
      categoryIds: [...f.categoryIds, root.id],
      subcategoryIds: without(subs, siblings),
    }
  return { ...f, subcategoryIds: subs }
}

export const toggleWallet = (f: SearchFilters, id: string): SearchFilters => ({
  ...f,
  walletIds: toggled(f.walletIds, id),
})
