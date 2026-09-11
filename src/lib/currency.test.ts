import { describe, expect, it } from 'vitest'
import { convertMinor, formatMoney, parseAmountToMinor } from './currency'

describe('formatMoney', () => {
  it('formats minor units with the currency symbol and grouping', () => {
    expect(formatMoney(1842050, 'SAR')).toBe('SR 18,420.50')
    expect(formatMoney(100000, 'USD')).toBe('$1,000.00')
  })
})

describe('parseAmountToMinor', () => {
  it('parses grouped decimal input into minor units', () => {
    expect(parseAmountToMinor('18,420.50', 'SAR')).toBe(1842050)
    expect(parseAmountToMinor('1000', 'USD')).toBe(100000)
  })

  it('returns null for non-numeric input', () => {
    expect(parseAmountToMinor('', 'SAR')).toBeNull()
    expect(parseAmountToMinor('abc', 'SAR')).toBeNull()
  })
})

describe('convertMinor', () => {
  const rates = { SAR: 1, USD: 3.75 }

  it('converts via the rate ratio', () => {
    // 1000.00 USD → 3750.00 SAR
    expect(convertMinor(100000, 'USD', 'SAR', rates)).toBe(375000)
    // 3750.00 SAR → 1000.00 USD
    expect(convertMinor(375000, 'SAR', 'USD', rates)).toBe(100000)
  })

  it('is a no-op for the same currency', () => {
    expect(convertMinor(1842050, 'SAR', 'SAR', rates)).toBe(1842050)
  })
})
