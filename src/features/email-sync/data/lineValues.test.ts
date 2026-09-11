import { describe, expect, it } from 'vitest'
import { readLineValues } from './lineValues'

describe('readLineValues', () => {
  it('reads the amount and currency out of a tapped alert line', () => {
    expect(readLineValues('Amount: SAR 245.00', 'USD')).toEqual({
      amountMinor: 24500,
      currency: 'SAR',
    })
  })

  it('handles thousands separators', () => {
    expect(readLineValues('Available balance: SAR 8,410.50', 'SAR')).toEqual({
      amountMinor: 841050,
      currency: 'SAR',
    })
  })

  it('scales by the caller’s currency when the line names none', () => {
    expect(readLineValues('Charged 99.90', 'USD')).toEqual({
      amountMinor: 9990,
      currency: null,
    })
  })

  it('returns the currency alone when the line has no number', () => {
    expect(readLineValues('Paid in SAR', 'USD')).toEqual({
      amountMinor: null,
      currency: 'SAR',
    })
  })

  it('gives nothing for a line with neither', () => {
    expect(readLineValues('Dear KHALID AL-RASHID,', 'SAR')).toEqual({
      amountMinor: null,
      currency: null,
    })
  })

  it('ignores a zero amount — it would never be a valid entry', () => {
    expect(readLineValues('Fee: SAR 0.00', 'SAR').amountMinor).toBeNull()
  })
})
