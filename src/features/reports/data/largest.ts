import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { fmtShort, parseISO } from '#/features/transactions/data/planning'
import type { IconId } from '#/lib/icons/catalog.gen'
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { FlowRow } from './flowRows'

export const LARGEST_COUNT = 6

export type LargestItem = {
  id: string
  /** The merchant, else the note, else the category it was filed under. */
  title: string
  /** "Jun 3 · Dining". */
  sub: string
  amountStr: string
  color: string
  icon: IconId
}

/** The period's biggest single spends. */
export function buildLargest(
  cur: ReadonlyArray<FlowRow>,
  catalog: CategoryCatalog,
  merchantNames: ReadonlyMap<string, string>,
  base: CurrencyCode,
): LargestItem[] {
  return cur
    .filter((r) => r.type === 'spend')
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
    .slice(0, LARGEST_COUNT)
    .map((r) => {
      const root = catalog.rootOf(r.categoryId)
      const leaf = catalog.get(r.categoryId)
      const merchant = r.merchantId
        ? merchantNames.get(r.merchantId)
        : undefined
      return {
        id: r.id,
        title: merchant || r.note || leaf.name,
        sub: `${fmtShort(parseISO(r.date))} · ${root.name}`,
        amountStr: formatMoneyRounded(r.amount, base),
        color: root.color,
        icon: leaf.icon,
      }
    })
}
