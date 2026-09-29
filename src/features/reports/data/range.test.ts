import { describe, expect, it } from 'vitest'
import { daysIn, ymd } from '#/features/transactions/data/planning'
import {
  presetLabel,
  readSpans,
  reportRange,
  shiftMonths,
  spanCaption,
} from './range'
import type { Comparison, RangePreset, ReportWindow } from './range'

const TODAY = new Date(2026, 8, 29)
const MONTH_END = new Date(2026, 4, 31)
const NO_CUSTOM = { start: '', end: '' }

const isoOf = (w: ReportWindow) => [ymd(w.start), ymd(w.dataEnd), ymd(w.end)]

const range = (
  preset: RangePreset,
  today: Date,
  comparison: Comparison = 'prev',
  custom = NO_CUSTOM,
) => reportRange(preset, custom, comparison, today)

describe('reportRange presets', () => {
  it.each([
    [
      'this_month',
      ['2026-09-01', '2026-09-29', '2026-09-30'],
      'Sep 1 – 29, 2026 · so far',
    ],
    [
      'last_month',
      ['2026-08-01', '2026-08-31', '2026-08-31'],
      'Aug 1 – 31, 2026',
    ],
    [
      'last_3',
      ['2026-07-01', '2026-09-29', '2026-09-30'],
      'Jul 1 – Sep 29, 2026 · so far',
    ],
    [
      'last_6',
      ['2026-04-01', '2026-09-29', '2026-09-30'],
      'Apr 1 – Sep 29, 2026 · so far',
    ],
    [
      'last_12',
      ['2025-10-01', '2026-09-29', '2026-09-30'],
      'Oct 1, 2025 – Sep 29, 2026 · so far',
    ],
    ['ytd', ['2026-01-01', '2026-09-29', '2026-09-29'], 'Jan 1 – Sep 29, 2026'],
    [
      'last_year',
      ['2025-01-01', '2025-12-31', '2025-12-31'],
      'Jan 1 – Dec 31, 2025',
    ],
  ] as const)('%s on Sep 29, 2026', (preset, isos, caption) => {
    const r = range(preset, TODAY)
    expect(isoOf(r)).toEqual(isos)
    expect(r.caption).toBe(caption)
    expect(r.partial).toBe(caption.endsWith('· so far'))
  })

  it.each([
    [
      'this_month',
      ['2026-05-01', '2026-05-31', '2026-05-31'],
      'May 1 – 31, 2026',
    ],
    [
      'last_month',
      ['2026-04-01', '2026-04-30', '2026-04-30'],
      'Apr 1 – 30, 2026',
    ],
    [
      'last_6',
      ['2025-12-01', '2026-05-31', '2026-05-31'],
      'Dec 1, 2025 – May 31, 2026',
    ],
    ['ytd', ['2026-01-01', '2026-05-31', '2026-05-31'], 'Jan 1 – May 31, 2026'],
  ] as const)(
    '%s on a month end is complete, not "so far"',
    (preset, isos, caption) => {
      const r = range(preset, MONTH_END)
      expect(isoOf(r)).toEqual(isos)
      expect(r.partial).toBe(false)
      expect(r.caption).toBe(caption)
    },
  )
})

describe('reportRange comparison', () => {
  it('compares a running month with the same days of the month before', () => {
    const r = range('this_month', TODAY)
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2026-08-01',
      '2026-08-29',
      '2026-08-31',
    ])
    expect(r.compare?.caption).toBe('Aug 1 – 29, 2026')
    expect(r.compare && daysIn({ ...r.compare, end: r.compare.dataEnd })).toBe(
      daysIn({ start: r.start, end: r.dataEnd }),
    )
  })

  it('steps last 6 months back six whole months, stopping at the same day', () => {
    const r = range('last_6', TODAY)
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2025-10-01',
      '2026-03-29',
      '2026-03-31',
    ])
    expect(r.compare?.caption).toBe('Oct 1, 2025 – Mar 29, 2026')
  })

  it('compares a whole month with the whole month before, month ends kept', () => {
    const r = range('last_month', MONTH_END)
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2026-03-01',
      '2026-03-31',
      '2026-03-31',
    ])
  })

  it('compares with the same dates a year earlier', () => {
    const r = range('last_6', TODAY, 'yoy')
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2025-04-01',
      '2025-09-29',
      '2025-09-30',
    ])
    expect(r.compare?.caption).toBe('Apr 1 – Sep 29, 2025')
  })

  it('has no comparison window with none', () => {
    const r = range('last_6', TODAY, 'none')
    expect(r.compare).toBeNull()
    expect(r.caption).toBe('Apr 1 – Sep 29, 2026 · so far')
  })
})

describe('reportRange custom', () => {
  it('swaps reversed ends and steps back by its own length in days', () => {
    const r = range('custom', TODAY, 'prev', {
      start: '2026-06-14',
      end: '2026-06-01',
    })
    expect(isoOf(r)).toEqual(['2026-06-01', '2026-06-14', '2026-06-14'])
    expect(r.partial).toBe(false)
    expect(r.caption).toBe('Jun 1 – 14, 2026')
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2026-05-18',
      '2026-05-31',
      '2026-05-31',
    ])
    expect(r.compare?.caption).toBe('May 18 – 31, 2026')
  })

  it('reads a span running past today only up to today', () => {
    const r = range('custom', TODAY, 'prev', {
      start: '2026-09-20',
      end: '2026-10-10',
    })
    expect(r.partial).toBe(true)
    expect(isoOf(r)).toEqual(['2026-09-20', '2026-09-29', '2026-10-10'])
    expect(r.caption).toBe('Sep 20 – 29, 2026 · so far')
    expect(r.compare && isoOf(r.compare)).toEqual([
      '2026-08-30',
      '2026-09-08',
      '2026-09-19',
    ])
  })

  it('never reads a span that starts after today backwards', () => {
    const r = range('custom', TODAY, 'prev', {
      start: '2026-10-05',
      end: '2026-10-10',
    })
    expect(r.dataEnd >= r.start).toBe(true)
    expect(r.caption).not.toContain('Oct 5 – Sep 29')
  })
})

describe('readSpans', () => {
  it('reads the period and its comparison', () => {
    expect(readSpans(range('this_month', TODAY))).toEqual([
      ['2026-09-01', '2026-09-29'],
      ['2026-08-01', '2026-08-29'],
    ])
    expect(readSpans(range('this_month', TODAY, 'none'))).toEqual([
      ['2026-09-01', '2026-09-29'],
    ])
  })
})

describe('shiftMonths', () => {
  it('keeps a month end on the new month end', () => {
    expect(ymd(shiftMonths(new Date(2026, 2, 31), -1))).toBe('2026-02-28')
    expect(ymd(shiftMonths(new Date(2028, 2, 31), -1))).toBe('2028-02-29')
    expect(ymd(shiftMonths(new Date(2026, 1, 28), 1))).toBe('2026-03-31')
    expect(ymd(shiftMonths(new Date(2026, 3, 30), -12))).toBe('2025-04-30')
  })

  it('clamps a day the new month lacks and keeps any other day', () => {
    expect(ymd(shiftMonths(new Date(2026, 0, 30), 1))).toBe('2026-02-28')
    expect(ymd(shiftMonths(new Date(2028, 1, 28), 1))).toBe('2028-03-28')
    expect(ymd(shiftMonths(new Date(2026, 7, 15), -6))).toBe('2026-02-15')
    expect(ymd(shiftMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-15')
  })
})

describe('spanCaption', () => {
  it('names one day, a span in a month, in a year, and across years', () => {
    const d = (m: number, day: number, y = 2026) => new Date(y, m, day)
    expect(spanCaption(d(5, 3), d(5, 3))).toBe('Jun 3, 2026')
    expect(spanCaption(d(5, 3), d(5, 14))).toBe('Jun 3 – 14, 2026')
    expect(spanCaption(d(5, 3), d(6, 14))).toBe('Jun 3 – Jul 14, 2026')
    expect(spanCaption(d(11, 30, 2025), d(0, 2))).toBe(
      'Dec 30, 2025 – Jan 2, 2026',
    )
  })
})

describe('presetLabel', () => {
  it('names last year by its number', () => {
    expect(presetLabel('last_year', TODAY)).toBe('Last year (2025)')
    expect(presetLabel('last_6', TODAY)).toBe('Last 6 months')
    expect(presetLabel('custom', TODAY)).toBe('Custom range')
  })
})
