import { describe, expect, it } from 'vitest'
import {
  detectDecimal,
  detectDelimiter,
  detectHeader,
  detectQuote,
  sampleLines,
} from './dialect'

const lines = (text: string, quote = '"'): string[] => sampleLines(text, quote)

describe('sampleLines', () => {
  it('keeps a newline inside a quoted field on one line', () => {
    const text = 'a,b\n1,"two\nlines"\n3,four\n'
    expect(lines(text)).toEqual(['a,b', '1,"two\nlines"', '3,four'])
  })

  it('drops blank lines and stops at the limit', () => {
    expect(sampleLines('a\n\n\nb\nc\n', '"', 2)).toEqual(['a', 'b'])
  })
})

describe('detectDelimiter', () => {
  it.each([
    [',', 'Date,Description,Amount'],
    [';', 'Datum;Text;Betrag'],
    ['\t', 'Date\tDescription\tAmount'],
    ['|', 'Date|Details|Amount'],
  ])('finds %j', (delimiter, header) => {
    const body = [header, header, header].join('\n')
    expect(detectDelimiter(lines(body))).toBe(delimiter)
  })

  it('prefers the consistent separator over commas inside descriptions', () => {
    const body = [
      'Date|Details|Amount',
      '16-Jun-2026|PANDA, RIYADH|142.50',
      '17-Jun-2026|ACME, LTD|12000.00',
    ].join('\n')
    expect(detectDelimiter(lines(body))).toBe('|')
  })

  it('ignores delimiters inside quoted fields', () => {
    const body = [
      'Date,Description,Amount',
      '16/06/2026,"TESCO, LONDON, UK",42.15',
      '17/06/2026,"ACME, LTD",2450.00',
    ].join('\n')
    expect(detectDelimiter(lines(body))).toBe(',')
  })

  it('is not vetoed by preamble lines that carry no delimiter', () => {
    const body = [
      'Al Rajhi Bank',
      'Account statement',
      'Period: 01/06/2026 - 30/06/2026',
      'Date,Details,Debit,Credit,Balance',
      '16/06/2026,POS,142.50,,12857.20',
      '17/06/2026,SALARY,,12000.00,24857.20',
    ].join('\n')
    expect(detectDelimiter(lines(body))).toBe(',')
  })
})

describe('detectQuote', () => {
  it('defaults to the double quote', () => {
    expect(detectQuote(lines('a,b\n1,"two"\n'))).toBe('"')
    expect(detectQuote(lines('a,b\n1,2\n'))).toBe('"')
  })

  it('switches when single quotes wrap the values', () => {
    const body = ["'Date','Details','Amount'", "'16/06/2026','POS','142.50'"]
    expect(detectQuote(body)).toBe("'")
  })
})

describe('detectHeader', () => {
  it('finds the header under a preamble and reports the rows above it', () => {
    const matrix = [
      ['Al Rajhi Bank'],
      ['Account statement'],
      [''],
      ['Date', 'Details', 'Amount'],
      ['16/06/2026', 'POS', '142.50'],
      ['17/06/2026', 'SALARY', '12000.00'],
    ]
    expect(detectHeader(matrix)).toEqual({ skipRows: 3, hasHeader: true })
  })

  it('reports no header when the first full row is data', () => {
    const matrix = [
      ['16/06/2026', 'POS', '142.50'],
      ['17/06/2026', 'SALARY', '12000.00'],
    ]
    expect(detectHeader(matrix)).toEqual({ skipRows: 0, hasHeader: false })
  })

  it('does not mistake a row with a blank cell for the header', () => {
    const matrix = [
      ['Date', '', 'Amount'],
      ['Date', 'Details', 'Amount'],
      ['16/06/2026', 'POS', '142.50'],
    ]
    expect(detectHeader(matrix)).toEqual({ skipRows: 1, hasHeader: true })
  })
})

describe('detectDecimal', () => {
  it('reads 1.234,56 as a comma decimal', () => {
    const rows = [
      ['16.06.2026', 'REWE', '-1.234,56'],
      ['17.06.2026', 'GEHALT', '3.450,00'],
      ['18.06.2026', 'DB', '-59,90'],
    ]
    expect(detectDecimal(rows, ';')).toBe(',')
  })

  it('reads 1,234.56 as a dot decimal', () => {
    const rows = [
      ['16/06/2026', 'TESCO', '1,234.56'],
      ['17/06/2026', 'ACME', '2,450.00'],
      ['18/06/2026', 'TFL', '8.40'],
    ]
    expect(detectDecimal(rows, ',')).toBe('.')
  })

  it('abstains on a lone separator with three digits after it', () => {
    // 1.234 is a thousand in Berlin and 1.234 dinars in Kuwait; nothing here decides.
    const rows = [
      ['2026-06-18', 'SULTAN CENTER', '1.234'],
      ['2026-06-19', 'CITY CENTRE', '2.500'],
    ]
    expect(detectDecimal(rows, ',')).toBe('.')
    expect(detectDecimal(rows, ';')).toBe(',')
  })

  it('never reads the date column as the numeric one', () => {
    const rows = [
      ['16.06.2026', 'REWE', '12,34'],
      ['17.06.2026', 'GEHALT', '45,67'],
    ]
    expect(detectDecimal(rows, ';')).toBe(',')
  })
})
