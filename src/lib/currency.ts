import { currencyList, currencyMeta } from '#/lib/config/appConfig'
import type { CurrencyMeta } from '#/lib/config/appConfig'
import { numericInputProps } from '#/lib/numericInput'

/**
 * Currency metadata + money helpers. Money is an integer in the currency's minor unit
 * (e.g. cents) plus an ISO-4217 code — never a float — matching the wire/DB representation
 * end to end. Formatting to a display string happens only here, at the UI edge.
 *
 * The currency table itself is data now (`lib/config`), not a literal: any ISO-4217 code is
 * valid, its minor unit can be 0 (JPY), 2 or 3 (KWD), and validation happens at the two
 * boundaries where a code enters the app — the wire (`fromWireCurrency`) and the import
 * parser — rather than in the type.
 */
export type CurrencyCode = string

export const supportedCurrencies = (): CurrencyMeta[] => currencyList()

export const isSupportedCurrency = (code: string): boolean =>
  currencyMeta(code) !== undefined

/**
 * Wire boundary gate. An unknown code would silently mis-scale every amount stored under
 * it, so a mapper rejects the row rather than guessing — the same treatment enum mappers
 * give an unknown enum name.
 */
export const fromWireCurrency = (code: string): CurrencyCode => {
  if (!isSupportedCurrency(code)) {
    throw new Error(`Unsupported currency code: ${code}`)
  }
  return code
}

export const fromWireCurrencyOrNull = (
  code: string | null,
): CurrencyCode | null => (code === null ? null : fromWireCurrency(code))

/** The currency's symbol (e.g. "SR", "$") — handy as an input prefix. */
export const currencySymbol = (code: CurrencyCode): string =>
  currencyMeta(code)?.symbol ?? code

export const currencyName = (code: CurrencyCode): string =>
  currencyMeta(code)?.name ?? code

/** Minor-unit exponent: 0 for JPY, 3 for KWD, 2 for most. Unknown codes read as 2. */
export const decimalsFor = (code: CurrencyCode): number =>
  currencyMeta(code)?.minorUnit ?? 2

const scaleFor = (code: CurrencyCode): number => 10 ** decimalsFor(code)

// A letter-ending symbol ("SR", "CHF") needs air before the number; a glyph ("$") doesn't.
const prefixFor = (code: CurrencyCode): string => {
  const symbol = currencySymbol(code)
  return /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol
}

/** Minor units (e.g. 1842050) → major number (18420.5). */
export const toMajor = (amountMinor: number, code: CurrencyCode): number =>
  amountMinor / scaleFor(code)

/** Major number → minor units, rounded to the currency's precision. */
export const toMinor = (major: number, code: CurrencyCode): number =>
  Math.round(major * scaleFor(code))

/**
 * Parse a user-typed amount ("18,420.50") into minor units for the given currency.
 * Returns null when the input isn't a finite number.
 */
export const parseAmountToMinor = (
  input: string,
  code: CurrencyCode,
): number | null => {
  const cleaned = input.replace(/[\s,]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return toMinor(value, code)
}

/** Minor units → a plain editable string for inputs ("18420.5"), no symbol or grouping. */
export const minorToInputValue = (
  amountMinor: number,
  code: CurrencyCode,
): string => String(toMajor(amountMinor, code))

/**
 * What an amount field should offer for a currency: a yen input takes whole numbers, a
 * dinar input takes three decimals. Keeps keypad, typing guard and placeholder in one
 * decision; `onValue` only ever receives digits (plus a point, and a leading minus if `signed`).
 */
export const amountInputProps = (
  code: CurrencyCode,
  onValue: (value: string) => void,
  { signed = false }: { signed?: boolean } = {},
) => {
  const decimals = decimalsFor(code)
  return {
    ...numericInputProps({ decimals, signed }, onValue),
    placeholder: decimals === 0 ? '0' : `0.${'0'.repeat(decimals)}`,
  }
}

/** Format minor units as a display string, e.g. "SR 18,420.50". */
export const formatMoney = (
  amountMinor: number,
  code: CurrencyCode,
  locale = 'en-US',
): string => {
  const decimals = decimalsFor(code)
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toMajor(amountMinor, code))
  return `${prefixFor(code)}${formatted}`
}

/**
 * Format minor units as a whole-currency display string, e.g. "SR 18,421" — no minor digits.
 * The planning view rounds figures (monthly set-asides, targets) so the numbers read cleanly.
 */
export const formatMoneyRounded = (
  amountMinor: number,
  code: CurrencyCode,
  locale = 'en-US',
): string => {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(toMajor(amountMinor, code)))
  return `${prefixFor(code)}${formatted}`
}

/** Format minor units compactly for a chart scale, e.g. "SR 12K". */
export const formatMoneyCompact = (
  amountMinor: number,
  code: CurrencyCode,
  locale = 'en-US',
): string => {
  const formatted = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toMajor(amountMinor, code))
  return `${prefixFor(code)}${formatted}`
}

/**
 * Convert minor units from one currency to another using a rate map. Rates are "units of a
 * common reference per 1 unit of the currency", so the conversion is a pure ratio:
 * amount * rate[from] / rate[to]. Returns minor units in the target currency.
 */
export const convertMinor = (
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Partial<Record<string, number>>,
): number => {
  const rateFrom = rates[from]
  const rateTo = rates[to]
  if (!rateFrom || !rateTo) return from === to ? amountMinor : 0
  const major = toMajor(amountMinor, from) * (rateFrom / rateTo)
  return toMinor(major, to)
}
