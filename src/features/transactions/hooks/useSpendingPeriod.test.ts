import { describe, expect, it } from 'vitest'
import {
  parseISO,
  periodOf,
  toIsoPeriod,
} from '#/features/transactions/data/planning'
import type { Period } from '#/features/transactions/data/planning'
import { periodHoldingToday, steppedPeriod } from './useSpendingPeriod'

const custom = (start: string, end: string): Period => ({
  mode: 'custom',
  start: parseISO(start),
  end: parseISO(end),
})
const iso = (p: Period) => toIsoPeriod(p)

describe('steppedPeriod', () => {
  it('moves a custom span by its own length, both ends included', () => {
    const span = custom('2026-09-01', '2026-09-10')
    expect(iso(steppedPeriod(span, 1))).toEqual({
      mode: 'custom',
      start: '2026-09-11',
      end: '2026-09-20',
    })
    expect(iso(steppedPeriod(span, -1))).toEqual({
      mode: 'custom',
      start: '2026-08-22',
      end: '2026-08-31',
    })
  })

  it('moves a range mode to its neighbour', () => {
    const march = periodOf(parseISO('2026-03-01'), 'month')
    expect(iso(steppedPeriod(march, -1))).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    const week = periodOf(parseISO('2026-12-27'), 'week')
    expect(iso(steppedPeriod(week, 1)).start).toBe('2027-01-03')
  })
})

describe('periodHoldingToday', () => {
  const today = parseISO('2026-09-28')

  it('keeps a custom span’s length and ends it today', () => {
    expect(
      iso(periodHoldingToday(custom('2026-01-01', '2026-01-30'), today)),
    ).toEqual({ mode: 'custom', start: '2026-08-30', end: '2026-09-28' })
  })

  it('re-anchors a range mode on today', () => {
    expect(
      iso(periodHoldingToday(periodOf(parseISO('2024-05-01'), 'year'), today)),
    ).toEqual({ mode: 'year', start: '2026-01-01', end: '2026-12-31' })
  })
})
