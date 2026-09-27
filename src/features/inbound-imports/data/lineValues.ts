import type { CurrencyCode } from '#/lib/currency'
import { parseAmountToMinor } from '#/lib/currency'
import { currencyTokens } from '#/lib/lineTokens'

// A money number: digits with optional thousands separators and a decimal part.
const NUMBER = /\d[\d,]*(?:\.\d+)?/

type LineValues = {
  amountMinor: number | null
  currency: CurrencyCode | null
}

/**
 * Read an amount and a currency out of one body line, so tapping the line in the preview
 * fills the form. The currency found in the line decides the minor-unit scale; without one
 * the caller's current selection stands in.
 */
export function readLineValues(
  line: string,
  fallbackCurrency: CurrencyCode,
): LineValues {
  const currency = currencyTokens(line).at(0)?.text ?? null
  const number = NUMBER.exec(line)?.[0]
  const amountMinor = number
    ? parseAmountToMinor(number, currency ?? fallbackCurrency)
    : null
  return {
    amountMinor: amountMinor && amountMinor > 0 ? amountMinor : null,
    currency,
  }
}
