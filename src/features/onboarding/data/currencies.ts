import type { CurrencyCode } from '#/lib/currency'

/** Offered as one-tap cards; any other ISO currency is a search away. */
export const POPULAR_CURRENCIES: readonly CurrencyCode[] = [
  'SAR',
  'AED',
  'USD',
  'EUR',
  'GBP',
  'EGP',
]

/** The backend's `DEFAULT_BASE_CURRENCY`, so an untouched pick changes nothing. */
export const DEFAULT_CURRENCY: CurrencyCode = 'SAR'
