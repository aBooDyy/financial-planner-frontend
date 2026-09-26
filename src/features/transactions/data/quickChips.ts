import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TransactionType, TxType } from '#/features/transactions/api/types'

/** A category, or one of its subcategories, offered one tap away in Quick add. */
export type QuickChip = { category: string; subcategory: string | null }

export const QUICK_CHIP_COUNT = 4

/** How far back "frequent" looks, so last year's habits don't crowd out this month's. */
export const QUICK_CHIP_LOOKBACK_DAYS = 90

type Row = {
  type: TransactionType
  category: string | null
  subcategory: string | null
  date: string
  deleted: 0 | 1
}

const keyOf = (chip: QuickChip): string =>
  `${chip.category}/${chip.subcategory ?? ''}`

/**
 * The type's most-used categories since `from`, most used first and the latest use breaking a
 * tie, topped up with the catalog's first categories so a new user still gets a full row. A
 * category that no longer exists, or belongs to the other type, is never offered.
 */
export function quickChips(args: {
  rows: ReadonlyArray<Row>
  type: TxType
  catalog: CategoryCatalog
  from: string
  count?: number
}): QuickChip[] {
  const { rows, type, catalog, from, count = QUICK_CHIP_COUNT } = args
  const parents = new Set(catalog.byType(type).map((c) => c.slug))
  const tally = new Map<
    string,
    { chip: QuickChip; uses: number; last: string }
  >()

  for (const row of rows) {
    if (row.deleted !== 0 || row.type !== type || row.date < from) continue
    if (row.category === null || !parents.has(row.category)) continue
    const sub = catalog.sub(row.category, row.subcategory)
    const chip = { category: row.category, subcategory: sub?.slug ?? null }
    const key = keyOf(chip)
    const seen = tally.get(key)
    if (seen) {
      seen.uses += 1
      if (row.date > seen.last) seen.last = row.date
    } else {
      tally.set(key, { chip, uses: 1, last: row.date })
    }
  }

  const frequent = [...tally.values()]
    .sort((a, b) => b.uses - a.uses || b.last.localeCompare(a.last))
    .map((entry) => entry.chip)
    .slice(0, count)

  const taken = new Set(frequent.map(keyOf))
  const fill = catalog
    .byType(type)
    .map((c): QuickChip => ({ category: c.slug, subcategory: null }))
    .filter((chip) => !taken.has(keyOf(chip)))

  return [...frequent, ...fill].slice(0, count)
}
