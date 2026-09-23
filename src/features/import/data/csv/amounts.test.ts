import { describe, expect, it } from 'vitest'
import { decimalsFor } from '#/lib/currency'
import { isAmountLike, parseAmountCell, resolveCurrencyCode } from './amounts'

const NBSP = String.fromCharCode(0x00a0)
const NARROW_NBSP = String.fromCharCode(0x202f)
const RLM = String.fromCharCode(0x200f)

const dot = (cell: string, currency = 'SAR') =>
  parseAmountCell(cell, '.', currency)
const comma = (cell: string, currency = 'EUR') =>
  parseAmountCell(cell, ',', currency)

describe('parseAmountCell', () => {
  it('strips the thousands separator on either convention', () => {
    expect(dot('1,234.56')).toEqual({ minor: 123456, negative: false })
    expect(comma('1.234,56')).toEqual({ minor: 123456, negative: false })
    expect(comma('1.100,00')).toEqual({ minor: 110000, negative: false })
  })

  it('reads a parenthesised negative', () => {
    expect(dot('(142.50)')).toEqual({ minor: 14250, negative: true })
  })

  it('reads a trailing sign, as German and SAP exports write it', () => {
    expect(dot('142.50-')).toEqual({ minor: 14250, negative: true })
    expect(dot('-142.50')).toEqual({ minor: 14250, negative: true })
    expect(dot('+142.50')).toEqual({ minor: 14250, negative: false })
  })

  it('strips currency symbols and codes on either side', () => {
    expect(dot('SAR 142.50')).toEqual({ minor: 14250, negative: false })
    expect(dot('142.50 SAR')).toEqual({ minor: 14250, negative: false })
    expect(dot('$1,000', 'USD')).toEqual({ minor: 100000, negative: false })
    expect(dot('﷼142.50')).toEqual({ minor: 14250, negative: false })
  })

  it('strips the spaces a bank uses for grouping', () => {
    expect(comma(`1${NBSP}234,56`)).toEqual({ minor: 123456, negative: false })
    expect(comma(`1${NARROW_NBSP}234,56`)).toEqual({
      minor: 123456,
      negative: false,
    })
    expect(dot("1'234.56")).toEqual({ minor: 123456, negative: false })
  })

  it('reads Arabic-Indic digits and separators', () => {
    expect(dot('١٤٢٫٥٠')).toEqual({ minor: 14250, negative: false })
    expect(dot(`${RLM}-١٤٢٫٥٠`)).toEqual({ minor: 14250, negative: true })
    expect(comma('١٬٢٣٤٫٥٦')).toEqual({ minor: 123456, negative: false })
  })

  it('returns null for anything that is not a number', () => {
    expect(dot('')).toBeNull()
    expect(dot('   ')).toBeNull()
    expect(dot('N/A')).toBeNull()
    expect(dot('pending')).toBeNull()
    expect(dot('3 of 5')).toBeNull()
  })

  it('keeps a zero amount, unsigned', () => {
    expect(dot('0.00')).toEqual({ minor: 0, negative: false })
    expect(dot('(0.00)')).toEqual({ minor: 0, negative: false })
  })

  it('takes its scale from the currency, not a constant', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(decimalsFor('KWD')).toBe(3)
    expect(dot('1234', 'JPY')).toEqual({ minor: 1234, negative: false })
    expect(dot('1.234', 'KWD')).toEqual({ minor: 1234, negative: false })
    expect(dot('1.234', 'SAR')).toEqual({ minor: 123, negative: false })
    expect(comma('1.234', 'KWD')).toEqual({ minor: 1234000, negative: false })
  })

  it('refuses to scale an amount under a code the config does not list', () => {
    expect(dot('0.0125', 'BTC')).toBeNull()
  })
})

describe('resolveCurrencyCode', () => {
  it('is the import parser currency gate', () => {
    expect(resolveCurrencyCode(' sar ')).toBe('SAR')
    expect(resolveCurrencyCode('JPY')).toBe('JPY')
    expect(resolveCurrencyCode('BTC')).toBeNull()
    expect(resolveCurrencyCode('Saudi Riyal')).toBeNull()
  })
})

describe('isAmountLike', () => {
  it('recognises a number without knowing the decimal separator', () => {
    expect(isAmountLike('1.234,56')).toBe(true)
    expect(isAmountLike('-142.50')).toBe(true)
    expect(isAmountLike('SAR 142.50')).toBe(true)
    expect(isAmountLike('Balance')).toBe(false)
    expect(isAmountLike('')).toBe(false)
  })
})
