import { describe, expect, it } from 'vitest'
import { inferDateFormat, isDateLike, parseDateCell } from './dates'

const localIso = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

describe('parseDateCell', () => {
  it.each([
    ['2026-06-16', 'YYYY-MM-DD', '2026-06-16'],
    ['2026/06/16', 'YYYY/MM/DD', '2026-06-16'],
    ['16/06/2026', 'DD/MM/YYYY', '2026-06-16'],
    ['06/16/2026', 'MM/DD/YYYY', '2026-06-16'],
    ['16-06-2026', 'DD-MM-YYYY', '2026-06-16'],
    ['16.06.2026', 'DD.MM.YYYY', '2026-06-16'],
    ['04-Aug-2026', 'DD-MMM-YYYY', '2026-08-04'],
    ['4 August 2026', 'DD-MMM-YYYY', '2026-08-04'],
    ['Aug 4, 2026', 'MMM DD, YYYY', '2026-08-04'],
  ] as const)('parses %s as %s', (cell, token, iso) => {
    expect(parseDateCell(cell, token)).toBe(iso)
  })

  it('pivots a 2-digit year at 70', () => {
    expect(parseDateCell('16/06/69', 'DD/MM/YY')).toBe('2069-06-16')
    expect(parseDateCell('16/06/70', 'DD/MM/YY')).toBe('1970-06-16')
  })

  it('does not let a 4-digit year in as a 2-digit one, or the reverse', () => {
    expect(parseDateCell('16/06/2026', 'DD/MM/YY')).toBeNull()
    expect(parseDateCell('16/06/26', 'DD/MM/YYYY')).toBeNull()
  })

  it('rejects a date the calendar does not have', () => {
    expect(parseDateCell('30/02/2026', 'DD/MM/YYYY')).toBeNull()
    expect(parseDateCell('2026-13-01', 'YYYY-MM-DD')).toBeNull()
    expect(parseDateCell('', 'YYYY-MM-DD')).toBeNull()
  })

  it('truncates an ISO instant to the local calendar date', () => {
    for (const value of ['2026-08-04T10:11:00Z', '2026-08-04T22:00:00-08:00']) {
      expect(parseDateCell(value, 'ISO')).toBe(localIso(new Date(value)))
    }
  })

  it('takes a time with no offset as local wall time', () => {
    expect(parseDateCell('2026-08-04 23:30:00', 'ISO')).toBe('2026-08-04')
    expect(parseDateCell('2026-08-04', 'ISO')).toBe('2026-08-04')
  })
})

const column = (...values: string[]): string[] => values

describe('inferDateFormat', () => {
  it('settles on the only format the whole column fits', () => {
    expect(inferDateFormat(column('2026-06-16', '2026-07-01')).format).toBe(
      'YYYY-MM-DD',
    )
  })

  it('is proven day-first by a single day over 12', () => {
    const inferred = inferDateFormat(column('03/04/2026', '16/06/2026'))
    expect(inferred.format).toBe('DD/MM/YYYY')
    expect(inferred.ambiguous).toBe(false)
  })

  it('is proven month-first by a single second component over 12', () => {
    const inferred = inferDateFormat(column('03/04/2026', '06/16/2026'))
    expect(inferred.format).toBe('MM/DD/YYYY')
    expect(inferred.ambiguous).toBe(false)
  })

  it('falls back to the locale and says so when nothing decides', () => {
    const values = column('03/04/2026', '05/06/2026', '01/02/2026')
    const american = inferDateFormat(values, { locale: 'en-US' })
    const british = inferDateFormat(values, { locale: 'en-GB' })
    expect(american.format).toBe('MM/DD/YYYY')
    expect(british.format).toBe('DD/MM/YYYY')
    expect(american.ambiguous).toBe(true)
    expect(british.ambiguous).toBe(true)
  })

  it('is disqualified outright by one value it cannot parse', () => {
    const inferred = inferDateFormat(
      column('16/06/2026', '17/06/2026', 'pending'),
    )
    expect(inferred.format).toBeNull()
    expect(inferred.candidates).toEqual([])
  })

  it('ignores blank cells rather than failing on them', () => {
    const inferred = inferDateFormat(column('16/06/2026', '', '  '))
    expect(inferred.format).toBe('DD/MM/YYYY')
    expect(inferred.sampled).toBe(1)
  })

  it('prefers the plain date token over ISO for a column of plain dates', () => {
    expect(inferDateFormat(column('2026-06-16')).format).toBe('YYYY-MM-DD')
    expect(
      inferDateFormat(column('2026-06-16', '2026-06-17T09:00:00Z')).format,
    ).toBe('ISO')
  })

  it('reads the whole column, so evidence in the last row still counts', () => {
    const values = [
      ...Array.from({ length: 4999 }, () => '01/02/2026'),
      '31/12/2026',
    ]
    const inferred = inferDateFormat(values)
    expect(inferred.format).toBe('DD/MM/YYYY')
    expect(inferred.ambiguous).toBe(false)
    expect(inferred.sampled).toBe(5000)
  })

  it('reads a month-name column', () => {
    expect(inferDateFormat(column('16-Jun-2026', '04-Aug-2026')).format).toBe(
      'DD-MMM-YYYY',
    )
  })
})

describe('isDateLike', () => {
  it('recognises shapes without committing to a format', () => {
    expect(isDateLike('16/06/2026')).toBe(true)
    expect(isDateLike('16-Jun-2026')).toBe(true)
    expect(isDateLike('Aug 4, 2026')).toBe(true)
    expect(isDateLike('1.234,56')).toBe(false)
    expect(isDateLike('Balance')).toBe(false)
  })
})
