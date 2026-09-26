import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TransactionType, TxType } from '#/features/transactions/api/types'

/** A category, or one of its subcategories, offered one tap away in Quick add. */
export type QuickChip = { categoryId: string }

export const QUICK_CHIP_COUNT = 4

/** How far back "frequent" looks, so last year's habits don't crowd out this month's. */
export const QUICK_CHIP_LOOKBACK_DAYS = 90

/** How far back a typed amount looks for entries of the very same amount. */
export const AMOUNT_MATCH_LOOKBACK_DAYS = 30

/** The amount being typed, in minor units of `currency`, and how far back to match it. */
export type AmountHint = { minor: number; currency: string; from: string }

type Row = {
  type: TransactionType
  amount: number
  currency: string
  categoryId: string | null
  date: string
  deleted: 0 | 1
}

/** A category this catalog still holds, of the type being entered. */
const offered = (catalog: CategoryCatalog, id: string, type: TxType) =>
  catalog.has(id) && catalog.rootOf(id).type === type

/** The chips `rows` name, most used first and the latest use breaking a tie. */
function rank(
  rows: ReadonlyArray<Row>,
  catalog: CategoryCatalog,
  type: TxType,
): QuickChip[] {
  const tally = new Map<
    string,
    { chip: QuickChip; uses: number; last: string }
  >()
  for (const row of rows) {
    const id = row.categoryId
    if (id === null || !offered(catalog, id, type)) continue
    const seen = tally.get(id)
    if (seen) {
      seen.uses += 1
      if (row.date > seen.last) seen.last = row.date
    } else {
      tally.set(id, { chip: { categoryId: id }, uses: 1, last: row.date })
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.uses - a.uses || b.last.localeCompare(a.last))
    .map((entry) => entry.chip)
}

/**
 * The type's most-used categories since `from`, topped up with the catalog's first categories
 * so a new user still gets a full row. With an `amount`, every category recently used for that
 * exact amount leads, however many there are. A category that no longer exists, or belongs to
 * the other type, is never offered.
 */
export function quickChips(args: {
  rows: ReadonlyArray<Row>
  type: TxType
  catalog: CategoryCatalog
  from: string
  count?: number
  amount?: AmountHint | null
}): QuickChip[] {
  const { rows, type, catalog, from, count = QUICK_CHIP_COUNT, amount } = args
  const live = rows.filter(
    (row) => row.deleted === 0 && row.type === type && row.date >= from,
  )

  const matched = amount
    ? rank(
        live.filter(
          (row) =>
            row.amount === amount.minor &&
            row.currency === amount.currency &&
            row.date >= amount.from,
        ),
        catalog,
        type,
      )
    : []
  const frequent = rank(live, catalog, type).slice(0, count)
  const fill = catalog
    .byType(type)
    .map((c): QuickChip => ({ categoryId: c.id }))

  const seen = new Set<string>()
  const unique = [...matched, ...frequent, ...fill].filter((chip) => {
    if (seen.has(chip.categoryId)) return false
    seen.add(chip.categoryId)
    return true
  })
  return unique.slice(0, Math.max(count, matched.length))
}
