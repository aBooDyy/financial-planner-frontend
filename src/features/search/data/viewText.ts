import { SPENDING_VIEW_META } from '#/features/transactions/components/spendingViews'
import type { DateFormat } from '#/lib/date'
import { scopeDateLabel } from './filterLabels'
import type { SearchContext, SearchFilters } from './types'

export const WIDE_IDLE_TEXT =
  'Search every transaction, budget, bill, goal, planned item and account, whatever tab or account you are on.'

const viewLabel = (context: SearchContext): string =>
  SPENDING_VIEW_META[context.view].label

/** `narrow` is the context searched when not Everywhere; null searches everything. */
export const idleText = (narrow: SearchContext | null): string =>
  narrow
    ? `Searching ${viewLabel(narrow)} in ${narrow.scopeLabel}. Switch to Everywhere to include other tabs and accounts.`
    : WIDE_IDLE_TEXT

const results = (n: number): string => `${n} result${n === 1 ? '' : 's'}`

/** `trimmed` is the query as typed, trimmed; '' when only filters are set. */
export function headline(total: number, trimmed: string): string {
  if (trimmed)
    return total > 0
      ? `${results(total)} for “${trimmed}”`
      : `No matches for “${trimmed}”`
  return total > 0
    ? `${results(total)} matching filters`
    : 'No matches for these filters'
}

export function scopeNote(
  narrow: SearchContext | null,
  filters: SearchFilters,
  dateFormat: DateFormat,
): string {
  const dates = scopeDateLabel(filters, dateFormat)
  return narrow
    ? `${viewLabel(narrow)} · ${narrow.scopeLabel} · ${dates}`
    : `All tabs · all accounts · ${dates}`
}
