import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import type { IconId } from '#/lib/icons/catalog.gen'
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatShare } from '#/lib/percent'
import { pctDelta } from './delta'
import type { Delta } from './delta'
import type { FlowRow } from './flowRows'

/** What a row filed on the root itself, under no subcategory, is listed as. */
export const ROOT_ITSELF_LABEL = 'General'

export type SubcategoryItem = {
  id: string
  name: string
  shareStr: string
  amountStr: string
  /** Against the largest subcategory of its parent, 0–100. */
  barPct: number
  delta: Delta | null
}

export type CategoryItem = {
  id: string
  name: string
  color: string
  icon: IconId
  shareStr: string
  amountStr: string
  /** Against the largest category, 0–100. */
  barPct: number
  delta: Delta | null
  /** "12 transactions · avg SR 85 · SR 900 last period". */
  detail: string
  subs: SubcategoryItem[]
}

export type CategoryBreakdown = {
  totalStr: string
  items: CategoryItem[]
}

const totalsBy = (
  rows: ReadonlyArray<FlowRow>,
  key: (r: FlowRow) => string,
): Map<string, number> => {
  const out = new Map<string, number>()
  for (const r of rows) out.set(key(r), (out.get(key(r)) ?? 0) + r.amount)
  return out
}

const descending = (m: Map<string, number>): [string, number][] =>
  [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

const shareOf = (part: number, whole: number): string =>
  formatShare(whole > 0 ? (part / whole) * 100 : 0)

/**
 * Each root category of one type, largest first, with its share and change against the
 * comparison — and, beneath it, the subcategories its rows were filed under.
 */
export function buildCategoryBreakdown(
  cur: ReadonlyArray<FlowRow>,
  prev: ReadonlyArray<FlowRow> | null,
  type: TxType,
  catalog: CategoryCatalog,
  base: CurrencyCode,
): CategoryBreakdown {
  const rows = cur.filter((r) => r.type === type)
  const prevRows = prev?.filter((r) => r.type === type) ?? null
  const rootOf = (r: FlowRow) => catalog.rootOf(r.categoryId).id
  const byRoot = descending(totalsBy(rows, rootOf))
  const prevByRoot = prevRows ? totalsBy(prevRows, rootOf) : null
  const total = byRoot.reduce((sum, [, v]) => sum + v, 0)
  const largest = byRoot[0]?.[1] ?? 1
  const goodWhenUp = type === 'income'
  const money = (v: number) => formatMoneyRounded(v, base)

  const items = byRoot.map(([rootId, amount]): CategoryItem => {
    const root = catalog.get(rootId)
    const own = rows.filter((r) => rootOf(r) === rootId)
    const prevOwn = prevRows?.filter((r) => rootOf(r) === rootId) ?? null
    const prevAmount = prevByRoot?.get(rootId) ?? 0
    const bySub = descending(totalsBy(own, (r) => r.categoryId))
    const prevBySub = prevOwn ? totalsBy(prevOwn, (r) => r.categoryId) : null
    const largestSub = bySub[0]?.[1] ?? 1
    const count = own.length
    const detail = [
      `${count} transaction${count === 1 ? '' : 's'}`,
      `avg ${money(amount / Math.max(count, 1))}`,
      ...(prevByRoot ? [`${money(prevAmount)} last period`] : []),
    ].join(' · ')

    return {
      id: rootId,
      name: root.name,
      color: root.color,
      icon: root.icon,
      shareStr: shareOf(amount, total),
      amountStr: money(amount),
      barPct: (amount / largest) * 100,
      delta: prevByRoot ? pctDelta(amount, prevAmount, goodWhenUp) : null,
      detail,
      subs: bySub.map(([id, v]) => ({
        id,
        name: id === rootId ? ROOT_ITSELF_LABEL : catalog.get(id).name,
        shareStr: shareOf(v, amount),
        amountStr: money(v),
        barPct: (v / largestSub) * 100,
        delta: prevBySub
          ? pctDelta(v, prevBySub.get(id) ?? 0, goodWhenUp)
          : null,
      })),
    }
  })

  return { totalStr: `${money(total)} total`, items }
}
