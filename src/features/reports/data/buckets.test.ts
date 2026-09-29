import { describe, expect, it } from 'vitest'
import { addDays, parseISO, ymd } from '#/features/transactions/data/planning'
import { bucketsOf, granularityOf } from './buckets'
import { reportRange } from './range'
import type { RangePreset } from './range'

const TODAY = new Date(2026, 8, 29)

const preset = (p: RangePreset) =>
  reportRange(p, { start: '', end: '' }, 'none', TODAY)

const custom = (start: string, end: string) =>
  reportRange('custom', { start, end }, 'none', TODAY)

const spanOfDays = (days: number) => {
  const start = new Date(2026, 0, 1)
  return { start, end: addDays(start, days - 1) }
}

describe('granularityOf', () => {
  it('reads up to 8 days by day, up to 100 by week, anything longer by month', () => {
    expect(granularityOf(spanOfDays(1))).toBe('day')
    expect(granularityOf(spanOfDays(8))).toBe('day')
    expect(granularityOf(spanOfDays(9))).toBe('week')
    expect(granularityOf(spanOfDays(100))).toBe('week')
    expect(granularityOf(spanOfDays(101))).toBe('month')
  })

  it('picks weeks for a month or a quarter and months for half a year', () => {
    expect(granularityOf(preset('this_month'))).toBe('week')
    expect(granularityOf(preset('last_3'))).toBe('week')
    expect(granularityOf(preset('last_6'))).toBe('month')
  })
})

describe('bucketsOf', () => {
  it('lays out days by weekday, the ones after today in the future', () => {
    const b = bucketsOf(custom('2026-09-25', '2026-10-01'), TODAY)
    expect(b.map((x) => x.label)).toEqual([
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
    ])
    expect(b[0].title).toBe('Friday, Sep 25')
    expect(b.map((x) => x.future)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ])
  })

  it('lays out weeks from the period start, the last one cut at its end', () => {
    const b = bucketsOf(preset('this_month'), TODAY)
    expect(b.map((x) => [ymd(x.start), ymd(x.end)])).toEqual([
      ['2026-09-01', '2026-09-07'],
      ['2026-09-08', '2026-09-14'],
      ['2026-09-15', '2026-09-21'],
      ['2026-09-22', '2026-09-28'],
      ['2026-09-29', '2026-09-30'],
    ])
    expect(b.map((x) => x.label)).toEqual([
      'Sep 1',
      'Sep 8',
      'Sep 15',
      'Sep 22',
      'Sep 29',
    ])
    expect(b[0].title).toBe('Sep 1 – 7, 2026')
    expect(b[4].title).toBe('Sep 29 – 30, 2026')
    expect(b.some((x) => x.future)).toBe(false)
  })

  it('flags weeks that start after today', () => {
    const b = bucketsOf(custom('2026-09-15', '2026-10-15'), TODAY)
    expect(b.map((x) => x.future)).toEqual([false, false, false, true, true])
  })

  it('labels months without a year while the period stays in one year', () => {
    const b = bucketsOf(preset('last_6'), TODAY)
    expect(b.map((x) => x.label)).toEqual([
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
    ])
    expect(b[0].title).toBe('April 2026')
  })

  it('adds the year to the first month and each January across years', () => {
    const b = bucketsOf(preset('last_12'), TODAY)
    expect(b.map((x) => x.label)).toEqual([
      "Oct '25",
      'Nov',
      'Dec',
      "Jan '26",
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
    ])
    expect(b[0].title).toBe('October 2025')
  })

  it('marks the running month "so far" and later months future', () => {
    const b = bucketsOf(custom('2026-08-15', '2026-12-31'), TODAY)
    expect(b.map((x) => [ymd(x.start), ymd(x.end)])).toEqual([
      ['2026-08-15', '2026-08-31'],
      ['2026-09-01', '2026-09-30'],
      ['2026-10-01', '2026-10-31'],
      ['2026-11-01', '2026-11-30'],
      ['2026-12-01', '2026-12-31'],
    ])
    expect(b.map((x) => x.title)).toEqual([
      'August 2026',
      'September 2026 · so far',
      'October 2026',
      'November 2026',
      'December 2026',
    ])
    expect(b.map((x) => x.future)).toEqual([false, false, true, true, true])
  })

  it('does not call a month that ends today "so far"', () => {
    const b = bucketsOf(
      reportRange(
        'last_6',
        { start: '', end: '' },
        'none',
        parseISO('2026-05-31'),
      ),
      parseISO('2026-05-31'),
    )
    expect(b.at(-1)?.title).toBe('May 2026')
    expect(b[0].label).toBe("Dec '25")
  })
})
