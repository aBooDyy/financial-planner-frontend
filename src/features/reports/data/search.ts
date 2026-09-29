import { parseISODate } from '#/lib/date'
import { isComparison, isRangePreset } from './range'
import type { Comparison, RangePreset } from './range'

/**
 * The report's controls, in the URL so a report is linkable and survives a reload. A value
 * left at its default is left out.
 */
export type ReportsSearch = {
  range?: RangePreset
  /** The custom span's ISO ends; only with `range=custom`. */
  from?: string
  to?: string
  compare?: Comparison
  /** The account filter, as `scopeToValue` writes it. */
  accounts?: string
}

const isoOrNull = (value: unknown): string | null =>
  typeof value === 'string' && parseISODate(value) ? value : null

export function parseReportsSearch(
  search: Record<string, unknown>,
): ReportsSearch {
  const out: ReportsSearch = {}
  if (isRangePreset(search.range)) {
    const from = isoOrNull(search.from)
    const to = isoOrNull(search.to)
    if (search.range !== 'custom') out.range = search.range
    else if (from && to) Object.assign(out, { range: 'custom', from, to })
  }
  if (isComparison(search.compare)) out.compare = search.compare
  if (typeof search.accounts === 'string' && search.accounts !== '')
    out.accounts = search.accounts
  return out
}
