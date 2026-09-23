import { getAppConfig } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import { parseAmountToMinor } from '#/lib/currency'

// A money number: digits with optional thousands separators and a decimal part.
const NUMBER = /\d[\d,]*(?:\.\d+)?/

let cached: { version: string; pattern: RegExp } | null = null

/**
 * Any known currency code as a whole word. Case-sensitive on purpose: bank alerts write the
 * code in caps, and matching case-insensitively across the full ISO table would catch
 * ordinary English words (TRY, ALL, CUP).
 */
const currencyPattern = (): RegExp => {
  const { version, currencies } = getAppConfig()
  if (!cached || cached.version !== version) {
    const codes = currencies.map((c) => c.code).join('|')
    cached = { version, pattern: new RegExp(`\\b(${codes})\\b`) }
  }
  return cached.pattern
}

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
  const currency = currencyPattern().exec(line)?.[1] ?? null
  const number = NUMBER.exec(line)?.[0]
  const amountMinor = number
    ? parseAmountToMinor(number, currency ?? fallbackCurrency)
    : null
  return {
    amountMinor: amountMinor && amountMinor > 0 ? amountMinor : null,
    currency,
  }
}
