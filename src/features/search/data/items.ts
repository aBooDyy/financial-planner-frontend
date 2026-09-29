import type { LocalBalanceNode, LocalMerchant } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import { parseISO } from '#/features/transactions/data/planning'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { isIconId } from '#/lib/icons/catalog.gen'
import type { SearchResultRow } from './types'

/** One searchable thing: the row it draws, and the facts the query and filters test. */
export type SearchItem = {
  /** Drawn only for the rows a group shows, so indexing never formats the rest. */
  row: () => SearchResultRow
  /** Lower-cased fields the query is matched against (`searchText`). */
  text: string
  /** Spend or income; null for what is neither (a transfer, an adjustment, an account). */
  flow: TxType | null
  /** The ISO date a date filter tests; null for what has none (a budget, an account). */
  date: string | null
  /** The leaf a row is filed under, or a category budget's root. */
  categoryId: string | null
  rootId: string | null
  /** A category budget caps its whole root, so picking any part of it keeps it. */
  wholeCategory: boolean
  /** The wallets it touches; empty when it is bound to none (an overall budget). */
  walletIds: string[]
  /** Its size in base-currency major units; null for what an amount filter cannot size. */
  baseMajor: number | null
  /** Items sharing it are occurrences of one schedule; only the soonest that passes is listed. */
  series?: string
}

/** What every item builder reads besides its own row. */
export type ItemContext = {
  catalog: CategoryCatalog
  base: CurrencyCode
  rates: RatesMap
  dateFormat: DateFormat
  nodeById: ReadonlyMap<string, LocalBalanceNode>
  merchantById: ReadonlyMap<string, LocalMerchant>
}

export const NEUTRAL_COLOR = 'var(--fp-text-3)'

export const toBaseMinor = (
  amount: number,
  currency: CurrencyCode,
  ctx: ItemContext,
): number => convertMinor(amount, currency, ctx.base, ctx.rates)

export const toBaseMajor = (
  amount: number,
  currency: CurrencyCode,
  ctx: ItemContext,
): number => toMajor(toBaseMinor(amount, currency, ctx), ctx.base)

/** "−€24.50" or "+€1,200.00", in the base currency. */
export const signedMoney = (
  amount: number,
  currency: CurrencyCode,
  incoming: boolean,
  ctx: ItemContext,
): string =>
  `${incoming ? '+' : '−'}${formatMoney(toBaseMinor(amount, currency, ctx), ctx.base)}`

export const dateLabel = (iso: string, ctx: ItemContext): string =>
  formatDate(parseISO(iso), ctx.dateFormat)

export const merchantName = (
  id: string | null,
  ctx: ItemContext,
): string | null =>
  id ? (ctx.merchantById.get(id)?.displayName ?? null) : null

/** A node's own icon when it has a valid one; null draws its initial. */
export const nodeIcon = (node: LocalBalanceNode | undefined): string | null =>
  node && isIconId(node.icon) ? node.icon : null
