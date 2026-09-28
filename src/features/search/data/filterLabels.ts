import { parseISO } from '#/features/transactions/data/planning'
import { formatMoney, formatMoneyRounded, toMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { amountBounds, dateActive } from './filters'
import type { SearchDateFilter, SearchFilters, SearchTypeFilter } from './types'

export const TYPE_FILTER_LABEL: Record<
  Exclude<SearchTypeFilter, 'any'>,
  string
> = {
  spend: 'Spending',
  income: 'Income',
}

const DATE_PRESET_LABEL: Record<
  Exclude<SearchDateFilter, 'any' | 'custom'>,
  string
> = {
  month: 'This month',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
}

/** A wire date in the user's format. */
export const isoDateLabel = (iso: string, dateFormat: DateFormat): string =>
  formatDate(parseISO(iso), dateFormat)

function customRangeLabel(f: SearchFilters, dateFormat: DateFormat): string {
  const from = f.from ? isoDateLabel(f.from, dateFormat) : 'Any'
  const to = f.to ? isoDateLabel(f.to, dateFormat) : 'now'
  return `${from} – ${to}`
}

/** "This month", "Last 30 days", "01/09/2026 – now"; null when no date filter is set. */
export function dateFilterLabel(
  f: SearchFilters,
  dateFormat: DateFormat,
): string | null {
  if (f.date === 'any' || !dateActive(f)) return null
  return f.date === 'custom'
    ? customRangeLabel(f, dateFormat)
    : DATE_PRESET_LABEL[f.date]
}

/** The date part of a scope note: "all dates", "this month", "01/09/2026 – now". */
export function scopeDateLabel(
  f: SearchFilters,
  dateFormat: DateFormat,
): string {
  if (f.date === 'any' || !dateActive(f)) return 'all dates'
  return f.date === 'custom'
    ? customRangeLabel(f, dateFormat)
    : DATE_PRESET_LABEL[f.date].toLowerCase()
}

// "€10" for a whole figure, "€10.50" once it has a fraction.
const boundLabel = (major: number, base: CurrencyCode): string => {
  const minor = toMinor(major, base)
  return Number.isInteger(major)
    ? formatMoneyRounded(minor, base)
    : formatMoney(minor, base)
}

/** "€10 – €50", "Any – €50", "€10 – any"; null when neither side is set. */
export function amountFilterLabel(
  f: SearchFilters,
  base: CurrencyCode,
): string | null {
  const { min, max } = amountBounds(f)
  if (min === null && max === null) return null
  const from = min === null ? 'Any' : boundLabel(min, base)
  const to = max === null ? 'any' : boundLabel(max, base)
  return `${from} – ${to}`
}
