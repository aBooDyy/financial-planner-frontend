import type { SpendingView } from '#/features/transactions/constants'
import type { Scope } from '#/features/transactions/data/selectors'

export type SearchTypeFilter = 'any' | 'spend' | 'income'

export type SearchDateFilter = 'any' | 'month' | '30' | '90' | 'custom'

export type SearchFilters = {
  type: SearchTypeFilter
  date: SearchDateFilter
  /** `YYYY-MM-DD`, or '' for open-ended; read only when `date` is 'custom'. */
  from: string
  to: string
  /** Roots picked whole — every child counts. */
  categoryIds: string[]
  /** Children picked on their own; their root is never also in `categoryIds`. */
  subcategoryIds: string[]
  walletIds: string[]
  /** Base-currency major units as typed; '' leaves that side open. */
  min: string
  max: string
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  type: 'any',
  date: 'any',
  from: '',
  to: '',
  categoryIds: [],
  subcategoryIds: [],
  walletIds: [],
  min: '',
  max: '',
}

/** The Spending tab and account scope a search can narrow to. */
export type SearchContext = {
  view: SpendingView
  scope: Scope
  /** "All accounts", "Main", "3 accounts" — the scope as the page's pill names it. */
  scopeLabel: string
}

/** What choosing a result opens. */
export type SearchTarget =
  | { kind: 'tx'; id: string }
  | { kind: 'adjustment'; id: string }
  | { kind: 'transfer'; transferId: string }
  | { kind: 'planned'; id: string }
  | { kind: 'bill'; id: string }
  | { kind: 'goal'; id: string }
  | { kind: 'budget'; id: string }
  | { kind: 'account'; id: string }

export type SearchResultRow = {
  key: string
  target: SearchTarget
  title: string
  /** "Dining · Main · 12 Sep" */
  sub: string
  /** "−€24.50", "+€1,200.00", "€400.00/mo" */
  valueStr: string
  positive: boolean
  color: string
  /** An icon id from the pack; null draws `title`'s first letter. */
  iconId: string | null
  /** Draws the transfer glyph instead of an icon. */
  transfer?: boolean
}

export type SearchGroupKey =
  | 'accounts'
  | 'transactions'
  | 'planned'
  | 'bills'
  | 'goals'
  | 'budgets'

export type SearchGroup = {
  key: SearchGroupKey
  title: string
  /** Every match, though `rows` stops at the display cap. */
  count: number
  rows: SearchResultRow[]
}

export type SearchView = {
  /** Neither a query nor a filter is set. */
  idle: boolean
  idleText: string
  groups: SearchGroup[]
  total: number
  empty: boolean
  /** `12 results for "din"` / `3 results matching filters` / `No matches for "din"` */
  headline: string
  /** "All tabs · all accounts · all dates" / "Activity · Main · last 30 days" */
  scopeNote: string
  /** Matches only Everywhere would add; 0 when already wide or nothing more. */
  moreElsewhere: number
}

/** One removable chip under the chip row for an active filter. */
export type ActiveFilterChip = {
  key: string
  label: string
  /** The filters with this one removed. */
  remove: (filters: SearchFilters) => SearchFilters
}
