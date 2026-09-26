import { isSupportedCurrency, toMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { asciiDigits } from '#/lib/digits'

/**
 * Amount reading for imported files. Every path ends at `toMinor`, which takes its scale
 * from the currency, so 1234 in JPY is 1234 minor units and 1.234 in KWD is also 1234 —
 * an amount mis-scaled by a factor of 100 is both silent and destructive.
 */

/** `minor` is always the magnitude; direction is the caller's business, from the mapping. */
export type ParsedAmount = { minor: number; negative: boolean }

// LRM, RLM, ALM, the embedding/override pairs and the isolates — invisible, and common in
// Arabic statement exports around every number.
const BIDI_MARKS = new RegExp(
  '[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]',
  'g',
)
const ARABIC_DECIMAL = /٫/g
const ARABIC_THOUSANDS = /٬/g

/** Letters wedged between digits mean the cell is prose, not a number ("3 of 5"). */
const PROSE = /\d[^\d.,]*(?:[A-Za-z]|\p{Script=Arabic})[^\d.,]*\d/u

/** Shape test for column detection, before the decimal separator is known. */
export const isAmountLike = (value: string): boolean => {
  const digits = asciiDigits(value)
    .replace(ARABIC_DECIMAL, '.')
    .replace(ARABIC_THOUSANDS, ',')
    .replace(/[^\d.,]/g, '')
  return /^\d[\d.,]*$/.test(digits)
}

/**
 * The import feature's currency gate — the second of the app's two, after the wire mapper.
 * An unlisted code would otherwise scale silently at two decimals.
 */
export const resolveCurrencyCode = (value: string): CurrencyCode | null => {
  const code = value.trim().toUpperCase()
  return isSupportedCurrency(code) ? code : null
}

/**
 * Parse one amount cell. Handles, in order: bidi marks and Arabic-Indic digits, parenthesised
 * negatives, a leading or trailing sign (SAP and German exports put it last), currency
 * symbols and ISO codes on either side, NBSP/narrow-NBSP/apostrophe grouping, and finally
 * the thousands separator — whichever one is not the file's decimal separator.
 */
export const parseAmountCell = (
  cell: string,
  decimal: '.' | ',',
  currency: CurrencyCode,
): ParsedAmount | null => {
  if (!isSupportedCurrency(currency)) return null

  let value = asciiDigits(cell.replace(BIDI_MARKS, '')).trim()
  if (value === '') return null
  value = value
    .replace(ARABIC_DECIMAL, decimal)
    .replace(ARABIC_THOUSANDS, decimal === '.' ? ',' : '.')

  let negative = false
  const parenthesised = /^\((.*)\)$/.exec(value)
  if (parenthesised) {
    negative = true
    value = parenthesised[1]
  }

  value = value.trim()
  const leading = /^[-−+]/.exec(value)
  if (leading) {
    if (leading[0] !== '+') negative = true
    value = value.slice(1).trim()
  }
  const trailing = /[-−+]$/.exec(value)
  if (trailing) {
    if (trailing[0] !== '+') negative = true
    value = value.slice(0, -1).trim()
  }

  if (PROSE.test(value)) return null

  const digits = value.replace(/[^\d.,]/g, '')
  if (digits === '') return null
  const thousands = decimal === '.' ? ',' : '.'
  const normalized = digits.split(thousands).join('').split(decimal).join('.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null

  const minor = toMinor(Number(normalized), currency)
  if (!Number.isSafeInteger(minor)) return null
  return { minor, negative: negative && minor !== 0 }
}
