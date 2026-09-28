import type { LocalBalanceNode } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { DELETED_ACCOUNT } from '#/features/transactions/data/selectors'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import {
  TYPE_FILTER_LABEL,
  amountFilterLabel,
  dateFilterLabel,
} from './filterLabels'
import type { ActiveFilterChip, SearchFilters } from './types'

export type ChipContext = {
  catalog: CategoryCatalog
  nodes: ReadonlyArray<LocalBalanceNode>
  base: CurrencyCode
  dateFormat: DateFormat
}

const dropId = (ids: ReadonlyArray<string>, id: string): string[] =>
  ids.filter((x) => x !== id)

function walletLabel(
  id: string,
  byId: ReadonlyMap<string, LocalBalanceNode>,
): string {
  const wallet = byId.get(id)
  if (!wallet) return DELETED_ACCOUNT
  const group = wallet.parentId ? byId.get(wallet.parentId) : undefined
  return group ? `${wallet.name} · ${group.name}` : wallet.name
}

/** One chip per active filter, in the order the filter panel lists them. */
export function activeFilterChips(
  f: SearchFilters,
  ctx: ChipContext,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  if (f.type !== 'any')
    chips.push({
      key: 'type',
      label: TYPE_FILTER_LABEL[f.type],
      remove: (x) => ({ ...x, type: 'any' }),
    })
  const date = dateFilterLabel(f, ctx.dateFormat)
  if (date)
    chips.push({
      key: 'date',
      label: date,
      remove: (x) => ({ ...x, date: 'any', from: '', to: '' }),
    })
  for (const id of f.categoryIds)
    chips.push({
      key: `category:${id}`,
      label: ctx.catalog.get(id).name,
      remove: (x) => ({ ...x, categoryIds: dropId(x.categoryIds, id) }),
    })
  for (const id of f.subcategoryIds)
    chips.push({
      key: `subcategory:${id}`,
      label: ctx.catalog.pathOf(id).join(' › '),
      remove: (x) => ({ ...x, subcategoryIds: dropId(x.subcategoryIds, id) }),
    })
  const byId = new Map(ctx.nodes.map((n) => [n.id, n]))
  for (const id of f.walletIds)
    chips.push({
      key: `wallet:${id}`,
      label: walletLabel(id, byId),
      remove: (x) => ({ ...x, walletIds: dropId(x.walletIds, id) }),
    })
  const amount = amountFilterLabel(f, ctx.base)
  if (amount)
    chips.push({
      key: 'amount',
      label: amount,
      remove: (x) => ({ ...x, min: '', max: '' }),
    })
  return chips
}
