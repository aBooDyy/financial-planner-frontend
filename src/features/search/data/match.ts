import { decimalsFor, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

// No typed query holds a newline, so a match can never straddle two fields.
const FIELD_SEPARATOR = '\n'

/** What a query is compared as: trimmed and lower-cased; '' matches everything. */
export const normalizeQuery = (query: string): string =>
  query.trim().toLowerCase()

/** One searchable string from a row's fields, empty ones dropped. */
export const searchText = (
  fields: ReadonlyArray<string | null | undefined>,
): string =>
  fields
    .filter((f): f is string => Boolean(f))
    .map((f) => f.toLowerCase())
    .join(FIELD_SEPARATOR)

/**
 * An amount as someone might type it: "2450.00" and "2,450.00". A substring of either —
 * "24", "24.5", "2,450" — then finds it.
 */
export function amountTexts(amountMinor: number, code: CurrencyCode): string[] {
  const major = Math.abs(toMajor(amountMinor, code))
  const decimals = decimalsFor(code)
  const grouped = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major)
  return [major.toFixed(decimals), grouped]
}

export const matchesQuery = (text: string, normalized: string): boolean =>
  normalized === '' || text.includes(normalized)
