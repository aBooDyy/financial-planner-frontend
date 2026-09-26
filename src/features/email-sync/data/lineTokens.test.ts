import { describe, expect, it } from 'vitest'
import { numberTokens, readNumber } from './lineTokens'

describe('numberTokens', () => {
  it('finds each number on a line with its span', () => {
    const line = 'Card 4471: SAR 1,234.50 at Jarir'
    expect(numberTokens(line)).toEqual([
      { start: 5, end: 9, text: '4471' },
      { start: 15, end: 23, text: '1,234.50' },
    ])
  })

  it('reads Arabic-Indic digits in place', () => {
    const [token] = numberTokens('المبلغ ٣٨٫٥٠ ريال')
    expect(token.text).toBe('٣٨٫٥٠')
  })
})

describe('readNumber', () => {
  it('reads each decimal style as asked', () => {
    expect(readNumber('1,234.56', 'dot')).toBe(1234.56)
    expect(readNumber('1.234,56', 'comma')).toBe(1234.56)
    expect(readNumber('1.234', 'comma')).toBe(1234)
    expect(readNumber('1.234', 'dot')).toBe(1.234)
  })

  it('guesses like the server when left on auto', () => {
    expect(readNumber('1,234', 'auto')).toBe(1234)
    expect(readNumber('38,50', 'auto')).toBe(38.5)
    expect(readNumber('1.234,56', 'auto')).toBe(1234.56)
  })

  it('refuses what does not read as a number that way', () => {
    expect(readNumber('1.234.56', 'dot')).toBeNull()
    expect(readNumber('abc', 'auto')).toBeNull()
  })
})
