import { describe, expect, it } from 'vitest'
import { formatDate, parseISODate } from './date'

const d = new Date(2026, 5, 6) // 6 June 2026 — single digits to check zero-padding

describe('formatDate', () => {
  it('defaults to day/month/year', () => {
    expect(formatDate(d)).toBe('06/06/2026')
  })

  it('formats month/day/year', () => {
    expect(formatDate(d, 'mdy')).toBe('06/06/2026')
  })

  it('formats year-month-day with dashes', () => {
    expect(formatDate(d, 'ymd')).toBe('2026-06-06')
  })

  it('orders day and month distinctly', () => {
    const dd = new Date(2026, 0, 31) // 31 Jan 2026
    expect(formatDate(dd, 'dmy')).toBe('31/01/2026')
    expect(formatDate(dd, 'mdy')).toBe('01/31/2026')
  })
})

describe('parseISODate', () => {
  it('round-trips a wire date into the chosen display format', () => {
    const d = parseISODate('2026-07-01')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // July, 0-indexed
    expect(d.getDate()).toBe(1)
    // The bug report: 2026-07-01 must read as day-first 01/07/2026, not 07/01/2026.
    expect(formatDate(d, 'dmy')).toBe('01/07/2026')
  })

  it('returns null for empty or malformed input', () => {
    expect(parseISODate('')).toBeNull()
    expect(parseISODate('2026-7-1')).toBeNull()
    expect(parseISODate('not-a-date')).toBeNull()
  })
})
