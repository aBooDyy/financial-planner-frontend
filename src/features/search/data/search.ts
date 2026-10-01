import type {
  LocalBalanceNode,
  LocalBudget,
  LocalMerchant,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { SpendingView } from '#/features/transactions/constants'
import { liveBalancesFrom } from '#/features/transactions/data/ledger'
import { walletMatcher } from '#/features/transactions/data/selectors'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import { accountItems } from './accountItems'
import { hasActiveFilters } from './filters'
import { inScope, itemPredicate } from './itemFilter'
import type { ItemContext, SearchItem } from './items'
import { ledgerItems } from './ledgerItems'
import { budgetItems, plannedItems } from './planItems'
import type {
  SearchContext,
  SearchFilters,
  SearchGroup,
  SearchGroupKey,
  SearchView,
} from './types'
import { headline, idleText, scopeNote } from './viewText'

/** The most rows a group lists; its count still says how many matched. */
export const SEARCH_ROW_CAP = 20

const GROUP_ORDER: ReadonlyArray<SearchGroupKey> = [
  'accounts',
  'transactions',
  'planned',
  'budgets',
]

const GROUP_TITLE: Record<SearchGroupKey, string> = {
  accounts: 'Accounts',
  transactions: 'Transactions',
  planned: 'Planned',
  budgets: 'Budgets',
}

const VIEW_GROUP: Record<SpendingView, SearchGroupKey> = {
  activity: 'transactions',
  planned: 'planned',
  budgets: 'budgets',
}

/** Every row search reads, unfiltered — deleted rows included; they are skipped here. */
export type SearchSources = {
  txns: LocalTransaction[]
  planned: LocalPlanned[]
  budgets: LocalBudget[]
  nodes: LocalBalanceNode[]
  merchants: LocalMerchant[]
  /** Each wallet's signed delta over the whole ledger, in its own currency. */
  deltas: Record<string, number>
  base: CurrencyCode
  rates: RatesMap
  catalog: CategoryCatalog
}

/** Everything searchable, built once per change to the sources and queried per keystroke. */
export type SearchIndex = {
  groups: Record<SearchGroupKey, SearchItem[]>
  nodes: LocalBalanceNode[]
  catalog: CategoryCatalog
  dateFormat: DateFormat
}

export type SearchQuery = {
  query: string
  filters: SearchFilters
  /** Everywhere; false narrows to `context` when there is one. */
  wide: boolean
  context: SearchContext | null
  /** ISO; what the relative date filters count back from. */
  today: string
}

export function indexSearch(
  sources: SearchSources,
  dateFormat: DateFormat,
): SearchIndex {
  const nodes = sources.nodes.filter((n) => n.deleted === 0)
  const ctx: ItemContext = {
    catalog: sources.catalog,
    base: sources.base,
    rates: sources.rates,
    dateFormat,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    merchantById: new Map(
      sources.merchants.filter((m) => m.deleted === 0).map((m) => [m.id, m]),
    ),
  }
  const balances = liveBalancesFrom(nodes, sources.deltas)
  return {
    groups: {
      accounts: accountItems(nodes, balances, ctx),
      transactions: ledgerItems(sources.txns, ctx),
      planned: plannedItems(sources.planned, ctx),
      budgets: budgetItems(sources.budgets, ctx),
    },
    nodes,
    catalog: sources.catalog,
    dateFormat,
  }
}

function soonestOfEachSeries(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (item.series === undefined) return true
    if (seen.has(item.series)) return false
    seen.add(item.series)
    return true
  })
}

const groupOf = (key: SearchGroupKey, items: SearchItem[]): SearchGroup => ({
  key,
  title: GROUP_TITLE[key],
  count: items.length,
  rows: items.slice(0, SEARCH_ROW_CAP).map((item) => item.row()),
})

/** The one group the context's tab shows, cut to the context's accounts. */
function narrowGroup(
  narrow: SearchContext,
  matched: ReadonlyMap<SearchGroupKey, SearchItem[]>,
  index: SearchIndex,
): SearchGroup {
  const key = VIEW_GROUP[narrow.view]
  const matcher = walletMatcher(narrow.scope, index.nodes)
  const items = (matched.get(key) ?? []).filter((item) =>
    inScope(item, matcher),
  )
  return groupOf(key, items)
}

/** Whether there is anything to search for: a query, or a filter on its own. */
export const isSearchActive = (
  query: string,
  filters: SearchFilters,
): boolean => query.trim() !== '' || hasActiveFilters(filters)

/** The view before anything is asked — it needs no index, so it draws before one exists. */
export function idleSearchView(
  q: Pick<SearchQuery, 'wide' | 'context' | 'filters'>,
  dateFormat: DateFormat,
): SearchView {
  const narrow = q.wide ? null : q.context
  return {
    idleText: idleText(narrow),
    scopeNote: scopeNote(narrow, q.filters, dateFormat),
    idle: true,
    groups: [],
    total: 0,
    empty: false,
    headline: '',
    moreElsewhere: 0,
  }
}

export function searchIndex(index: SearchIndex, q: SearchQuery): SearchView {
  const narrow = q.wide ? null : q.context
  const trimmed = q.query.trim()
  if (!isSearchActive(q.query, q.filters))
    return idleSearchView(q, index.dateFormat)
  const base = {
    idleText: idleText(narrow),
    scopeNote: scopeNote(narrow, q.filters, index.dateFormat),
  }

  const passes = itemPredicate(trimmed, q.filters, q.today, index.catalog)
  const matched = new Map(
    GROUP_ORDER.map((key) => [
      key,
      soonestOfEachSeries(index.groups[key].filter(passes)),
    ]),
  )
  const wideTotal = [...matched.values()].reduce((n, l) => n + l.length, 0)
  const groups = narrow
    ? [narrowGroup(narrow, matched, index)]
    : GROUP_ORDER.map((key) => groupOf(key, matched.get(key) ?? []))
  const shown = groups.filter((g) => g.count > 0)
  const total = shown.reduce((n, g) => n + g.count, 0)
  return {
    ...base,
    idle: false,
    groups: shown,
    total,
    empty: total === 0,
    headline: headline(total, trimmed),
    moreElsewhere: narrow ? Math.max(0, wideTotal - total) : 0,
  }
}

/** The whole search in one call: index the sources, then run the query over them. */
export const buildSearchView = (
  sources: SearchSources,
  options: SearchQuery & { dateFormat: DateFormat },
): SearchView => searchIndex(indexSearch(sources, options.dateFormat), options)
