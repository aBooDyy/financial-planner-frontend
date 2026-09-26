import { describe, expect, it } from 'vitest'
import {
  amountInputProps,
  convertMinor,
  decimalsFor,
  formatMoney,
  fromWireCurrency,
  fromWireCurrencyOrNull,
  isSupportedCurrency,
  minorToInputValue,
  parseAmountToMinor,
  toMajor,
  toMinor,
} from './currency'

describe('decimalsFor', () => {
  it('reads the minor unit from the config table, not a literal', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('SAR')).toBe(2)
    expect(decimalsFor('KWD')).toBe(3)
  })

  it('assumes two decimals for a code it does not know', () => {
    expect(decimalsFor('ZZZ')).toBe(2)
  })
})

describe('minor-unit round trips', () => {
  // A currency mis-scaled by 100× is a silent, destructive money bug — one case per class.
  const cases: Array<[string, string, number, string]> = [
    ['JPY', '1200', 1200, '1200'],
    ['SAR', '18420.50', 1842050, '18420.5'],
    ['KWD', '12.345', 12345, '12.345'],
  ]

  it.each(cases)(
    '%s survives parse → minor → input',
    (code, typed, minor, back) => {
      expect(parseAmountToMinor(typed, code)).toBe(minor)
      expect(minorToInputValue(minor, code)).toBe(back)
      expect(toMinor(toMajor(minor, code), code)).toBe(minor)
    },
  )

  it('rounds to the currency precision rather than keeping stray digits', () => {
    expect(parseAmountToMinor('1200.7', 'JPY')).toBe(1201)
    expect(parseAmountToMinor('12.3456', 'KWD')).toBe(12346)
  })
})

describe('formatMoney', () => {
  it('formats minor units with the currency symbol and grouping', () => {
    expect(formatMoney(1842050, 'SAR')).toBe('SR 18,420.50')
    expect(formatMoney(100000, 'USD')).toBe('$1,000.00')
  })

  it('shows the digits the currency actually has', () => {
    expect(formatMoney(1200, 'JPY')).toBe('¥1,200')
    expect(formatMoney(12345, 'KWD')).toBe('KD 12.345')
  })
})

describe('amountInputProps', () => {
  const noop = () => {}
  it('sizes an input from the currency', () => {
    expect(amountInputProps('JPY', noop)).toMatchObject({
      inputMode: 'numeric',
      placeholder: '0',
    })
    expect(amountInputProps('SAR', noop)).toMatchObject({
      inputMode: 'decimal',
      placeholder: '0.00',
    })
    expect(amountInputProps('KWD', noop)).toMatchObject({
      inputMode: 'decimal',
      placeholder: '0.000',
    })
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

describe('the wire boundary guard', () => {
  it('accepts any listed ISO code', () => {
    expect(isSupportedCurrency('JPY')).toBe(true)
    expect(fromWireCurrency('KWD')).toBe('KWD')
    expect(fromWireCurrencyOrNull(null)).toBeNull()
  })

  it('rejects a code the config does not list', () => {
    expect(isSupportedCurrency('XXX')).toBe(false)
    expect(() => fromWireCurrency('XXX')).toThrow(/XXX/)
    expect(() => fromWireCurrencyOrNull('sar')).toThrow()
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

  it('crosses a different minor unit correctly', () => {
    // 10,000 JPY at 0.025 SAR per yen → SR 250.00
    expect(convertMinor(10000, 'JPY', 'SAR', { SAR: 1, JPY: 0.025 })).toBe(
      25000,
    )
  })

  it('is a no-op for the same currency', () => {
    expect(convertMinor(1842050, 'SAR', 'SAR', rates)).toBe(1842050)
  })

  it('returns 0 for an unknown pair rather than inventing a rate', () => {
    expect(convertMinor(100000, 'SYP', 'SAR', rates)).toBe(0)
  })
})
