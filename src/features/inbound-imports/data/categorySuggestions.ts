import type { LocalMerchant, LocalTransaction } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'

const SUGGESTIONS_MAX = 5

/** What the user has filed one merchant under, ranked; the first is the one to pre-select. */
export type MerchantCategories = {
  merchantName: string
  categoryIds: string[]
}

/**
 * The merchant's last choice (or the one set on it by hand) first, then the other categories
 * its entries are filed under, most used first — of two used as often, the later one.
 */
export function rankMerchantCategories(
  merchant: LocalMerchant,
  transactions: LocalTransaction[],
  catalog: CategoryCatalog,
): string[] {
  const uses = new Map<string, { count: number; last: string }>()
  for (const tx of transactions) {
    if (tx.deleted === 1 || tx.merchantId !== merchant.id || !tx.categoryId)
      continue
    const seen = uses.get(tx.categoryId)
    uses.set(tx.categoryId, {
      count: (seen?.count ?? 0) + 1,
      last: seen && seen.last > tx.date ? seen.last : tx.date,
    })
  }
  const used = [...uses.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))
    .map(([id]) => id)
  const learned = merchant.learnedCategoryId ? [merchant.learnedCategoryId] : []
  return [...new Set([...learned, ...used])]
    .filter((id) => catalog.has(id))
    .slice(0, SUGGESTIONS_MAX)
}
