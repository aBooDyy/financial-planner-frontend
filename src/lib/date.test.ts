import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatRelativeTime,
  parseISODate,
  relativeDayLabel,
} from './date'

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

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-21T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('speaks in the largest unit the gap clears', () => {
    expect(formatRelativeTime(ago(45 * 1000), 'en-US', now)).toBe('now')
    expect(formatRelativeTime(ago(5 * 60_000), 'en-US', now)).toBe(
      '5 minutes ago',
    )
    expect(formatRelativeTime(ago(3 * 3_600_000), 'en-US', now)).toBe(
      '3 hours ago',
    )
    expect(formatRelativeTime(ago(2 * 86_400_000), 'en-US', now)).toBe(
      '2 days ago',
    )
    expect(formatRelativeTime(ago(20 * 86_400_000), 'en-US', now)).toBe(
      '2 weeks ago',
    )
    expect(formatRelativeTime(ago(70 * 86_400_000), 'en-US', now)).toBe(
      '2 months ago',
    )
  })

  it('carries the locale’s own wording', () => {
    expect(formatRelativeTime(ago(2 * 86_400_000), 'ar', now)).not.toBe(
      '2 days ago',
    )
  })

  it('returns null rather than “Invalid Date” for unreadable input', () => {
    expect(formatRelativeTime('', 'en-US', now)).toBeNull()
    expect(formatRelativeTime('not-a-date', 'en-US', now)).toBeNull()
  })
})

describe('relativeDayLabel', () => {
  const today = new Date(2026, 8, 26, 15, 30)
  it.each([
    ['2026-09-26', 'today'],
    ['2026-09-27', 'tomorrow'],
    ['2026-09-25', 'yesterday'],
    ['2026-10-01', 'in 5d'],
    ['2026-09-14', '12 days ago'],
    ['2027-09-26', 'in 12 mos'],
    ['2029-09-26', 'in 3y'],
  ])('%s reads %s', (iso, label) => {
    expect(relativeDayLabel(iso, today)).toBe(label)
  })

  it('is null for an unreadable date', () => {
    expect(relativeDayLabel('', today)).toBeNull()
  })
})
