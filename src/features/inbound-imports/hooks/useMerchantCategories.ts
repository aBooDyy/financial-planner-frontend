import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalInboundImport } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { rankMerchantCategories } from '#/features/inbound-imports/data/categorySuggestions'
import type { MerchantCategories } from '#/features/inbound-imports/data/categorySuggestions'

/** Each import's merchant and the categories it was filed under, by merchant id. */
export function useMerchantCategories(
  imports: LocalInboundImport[],
  catalog: CategoryCatalog,
): Map<string, MerchantCategories> {
  // A string, so the query re-runs when the set of merchants changes, not on every render.
  const key = [
    ...new Set(imports.flatMap((i) => (i.merchantId ? [i.merchantId] : []))),
  ]
    .sort()
    .join(',')
  const rows = useLiveQuery(async () => {
    const ids = key ? key.split(',') : []
    const merchants = await db.merchants.bulkGet(ids)
    const transactions = await db.transactions
      .where('merchantId')
      .anyOf(ids)
      .toArray()
    return { merchants, transactions }
  }, [key])

  const byMerchant = new Map<string, MerchantCategories>()
  for (const merchant of rows?.merchants ?? []) {
    if (!merchant || merchant.deleted === 1) continue
    byMerchant.set(merchant.id, {
      merchantName: merchant.displayName,
      categoryIds: rankMerchantCategories(
        merchant,
        rows?.transactions ?? [],
        catalog,
      ),
    })
  }
  return byMerchant
}
