/**
 * Currency metadata + money helpers. Money is an integer in the currency's minor unit
 * (e.g. cents) plus an ISO-4217 code — never a float — matching the wire/DB representation
 * end to end. Formatting to a display string happens only here, at the UI edge.
 */

export type CurrencyCode = 'SAR' | 'USD' | 'EUR' | 'GBP' | 'AED'

type CurrencyMeta = { symbol: string; decimals: number }

// Symbols mirror the Means design (custom prefixes); the numeric part uses `Intl`.
const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  SAR: { symbol: 'SR ', decimals: 2 },
  USD: { symbol: '$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  GBP: { symbol: '£', decimals: 2 },
  AED: { symbol: 'AED ', decimals: 2 },
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES) as CurrencyCode[]

/** The currency's symbol, trimmed (e.g. "SR", "$") — handy as an input prefix. */
export const currencySymbol = (code: CurrencyCode): string =>
  CURRENCIES[code].symbol.trim()

export const isSupportedCurrency = (code: string): code is CurrencyCode =>
  code in CURRENCIES

const decimalsFor = (code: CurrencyCode): number => CURRENCIES[code].decimals

const scaleFor = (code: CurrencyCode): number => 10 ** decimalsFor(code)

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
  return `${CURRENCIES[code].symbol}${formatted}`
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
  return `${CURRENCIES[code].symbol}${formatted}`
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
