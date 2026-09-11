import { describe, expect, it } from 'vitest'
import {
  advanceDue,
  budgetWindow,
  monthlyFactor,
  relFuture,
  windowOf,
  ymd,
} from './planning'

const TODAY = new Date(2026, 5, 12) // Jun 12, 2026

describe('windowOf', () => {
  it('spans the whole month in month mode', () => {
    const w = windowOf(new Date(2026, 5, 1), 'month')
    expect(ymd(w.start)).toBe('2026-06-01')
    expect(ymd(w.end)).toBe('2026-06-30')
  })

  it('spans Sun–Sat in week mode', () => {
    const w = windowOf(new Date(2026, 5, 12), 'week')
    expect(w.start.getDay()).toBe(0)
    expect(ymd(w.end)).toBe(
      ymd(
        new Date(
          w.start.getFullYear(),
          w.start.getMonth(),
          w.start.getDate() + 6,
        ),
      ),
    )
  })

  it('is a single day in day mode', () => {
    const w = windowOf(new Date(2026, 5, 12), 'day')
    expect(ymd(w.start)).toBe('2026-06-12')
    expect(ymd(w.end)).toBe('2026-06-12')
  })
})

describe('budgetWindow', () => {
  it('uses a rolling N-day window for custom periods', () => {
    const w = budgetWindow('custom', 14, TODAY)
    expect(ymd(w.end)).toBe('2026-06-12')
    expect(ymd(w.start)).toBe('2026-05-30')
  })
})

describe('advanceDue', () => {
  it('steps each cadence forward', () => {
    expect(advanceDue('2026-06-20', 'weekly')).toBe('2026-06-27')
    expect(advanceDue('2026-06-20', 'monthly')).toBe('2026-07-20')
    expect(advanceDue('2026-06-20', 'quarterly')).toBe('2026-09-20')
    expect(advanceDue('2026-06-20', 'annual')).toBe('2027-06-20')
  })
})

describe('relFuture', () => {
  it('describes upcoming dates relative to today', () => {
    expect(relFuture('2026-06-12', TODAY)).toBe('today')
    expect(relFuture('2026-06-13', TODAY)).toBe('tomorrow')
    expect(relFuture('2026-06-10', TODAY)).toBe('overdue')
    expect(relFuture('2026-06-15', TODAY)).toBe('in 3d')
  })
})

describe('monthlyFactor', () => {
  it('normalizes a cadence to a per-month factor', () => {
    expect(monthlyFactor('monthly')).toBe(1)
    expect(monthlyFactor('annual')).toBeCloseTo(1 / 12)
    expect(monthlyFactor('weekly')).toBeCloseTo(52 / 12)
  })
})
