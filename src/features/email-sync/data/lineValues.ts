import type { CurrencyCode } from '#/lib/currency'
import { parseAmountToMinor, SUPPORTED_CURRENCIES } from '#/lib/currency'

// A money number: digits with optional thousands separators and a decimal part.
const NUMBER = /\d[\d,]*(?:\.\d+)?/
const CURRENCY = new RegExp(`\\b(${SUPPORTED_CURRENCIES.join('|')})\\b`, 'i')

export type LineValues = {
  amountMinor: number | null
  currency: CurrencyCode | null
}

/**
 * Read an amount and a currency out of one email line, so tapping the line in the preview
 * fills the form. The currency found in the line decides the minor-unit scale; without one
 * the caller's current selection stands in.
 */
export function readLineValues(
  line: string,
  fallbackCurrency: CurrencyCode,
): LineValues {
  const code = CURRENCY.exec(line)?.[1]?.toUpperCase() as
    | CurrencyCode
    | undefined
  const currency = code ?? null
  const number = NUMBER.exec(line)?.[0]
  const amountMinor = number
    ? parseAmountToMinor(number, currency ?? fallbackCurrency)
    : null
  return { amountMinor: amountMinor && amountMinor > 0 ? amountMinor : null, currency }
}
