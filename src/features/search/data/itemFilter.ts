import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { amountBounds, dateBounds } from './filters'
import type { AmountBounds, DateBounds } from './filters'
import type { SearchItem } from './items'
import { matchesQuery, normalizeQuery } from './match'
import type { SearchFilters } from './types'

export type ItemPredicate = (item: SearchItem) => boolean

const inDates = (date: string | null, bounds: DateBounds): boolean =>
  date !== null &&
  (bounds.from === null || date >= bounds.from) &&
  (bounds.to === null || date <= bounds.to)

const inAmounts = (value: number | null, bounds: AmountBounds): boolean =>
  value !== null &&
  (bounds.min === null || value >= bounds.min) &&
  (bounds.max === null || value <= bounds.max)

function categoryTest(
  filters: SearchFilters,
  catalog: CategoryCatalog,
): ItemPredicate | null {
  if (filters.categoryIds.length + filters.subcategoryIds.length === 0)
    return null
  const roots = new Set(filters.categoryIds)
  const subs = new Set(filters.subcategoryIds)
  const partlyPicked = new Set(
    filters.subcategoryIds.map((id) => catalog.rootOf(id).id),
  )
  return (item) => {
    if (item.categoryId === null || item.rootId === null) return false
    if (roots.has(item.rootId)) return true
    return item.wholeCategory
      ? partlyPicked.has(item.rootId)
      : subs.has(item.categoryId)
  }
}

/** Whether an item matches the query and passes every filter set. */
export function itemPredicate(
  query: string,
  filters: SearchFilters,
  today: string,
  catalog: CategoryCatalog,
): ItemPredicate {
  const q = normalizeQuery(query)
  const dates = dateBounds(filters, today)
  const amounts = amountBounds(filters)
  const amountOn = amounts.min !== null || amounts.max !== null
  const inCategory = categoryTest(filters, catalog)
  const wallets = new Set(filters.walletIds)
  return (item) =>
    matchesQuery(item.text, q) &&
    (filters.type === 'any' || item.flow === filters.type) &&
    (dates === null || inDates(item.date, dates)) &&
    (inCategory === null || inCategory(item)) &&
    (wallets.size === 0 || item.walletIds.some((id) => wallets.has(id))) &&
    (!amountOn || inAmounts(item.baseMajor, amounts))
}

/** An item bound to no wallet (an overall budget) sits in every scope. */
export const inScope = (
  item: SearchItem,
  matcher: (walletId: string) => boolean,
): boolean => item.walletIds.length === 0 || item.walletIds.some(matcher)
