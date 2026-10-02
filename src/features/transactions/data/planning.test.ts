import { describe, expect, it } from 'vitest'
import { budgetWindow, windowOf, ymd } from './planning'

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

  it('reads a per-paycheck budget as the calendar month for now', () => {
    const w = budgetWindow('paycheck', null, TODAY)
    expect(ymd(w.start)).toBe('2026-06-01')
    expect(ymd(w.end)).toBe('2026-06-30')
  })
})
