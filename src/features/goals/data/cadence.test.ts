import { describe, expect, it } from 'vitest'
import { FREQUENCIES } from '#/features/goals/constants'
import {
  approxCyclesBetween,
  customFrequencyMeta,
  cycleMonthsOf,
  frequencyMetaOf,
  isValidInterval,
  stepDue,
} from './cadence'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('frequencyMetaOf', () => {
  it('reads a preset from the table', () => {
    const meta = frequencyMetaOf({
      frequency: 'quarterly',
      customInterval: null,
      customUnit: null,
    })
    expect(meta).toBe(FREQUENCIES.quarterly)
    expect(cycleMonthsOf(meta)).toBe(3)
  })

  it('builds a custom repeat from its interval', () => {
    const meta = frequencyMetaOf({
      frequency: 'custom',
      customInterval: 28,
      customUnit: 'day',
    })
    expect(meta.label).toBe('Every 28 days')
    expect(meta.every).toBe('every 28 days')
    expect(meta.short).toBe('/28d')
    expect(meta.perYear).toBeCloseTo(365 / 28)
    expect(cycleMonthsOf(meta)).toBe(1)
  })

  it('falls back when a custom repeat lost its interval', () => {
    const meta = frequencyMetaOf(
      { frequency: 'custom', customInterval: null, customUnit: null },
      'monthly',
    )
    expect(meta).toBe(FREQUENCIES.monthly)
  })
})

describe('customFrequencyMeta', () => {
  it('names a single unit without a count', () => {
    expect(customFrequencyMeta(1, 'week').label).toBe('Every week')
    expect(customFrequencyMeta(1, 'week').short).toBe('/wk')
  })

  it('reads whole months between dues for the planner', () => {
    expect(cycleMonthsOf(customFrequencyMeta(2, 'month'))).toBe(2)
    expect(cycleMonthsOf(customFrequencyMeta(60, 'day'))).toBe(2)
    expect(cycleMonthsOf(customFrequencyMeta(6, 'week'))).toBe(1)
  })
})

describe('stepDue', () => {
  const anchor = new Date(2026, 0, 31)

  it('steps days and weeks exactly', () => {
    expect(iso(stepDue(anchor, { unit: 'day', every: 28 }, 1))).toBe(
      '2026-02-28',
    )
    expect(iso(stepDue(anchor, { unit: 'week', every: 2 }, -1))).toBe(
      '2026-01-17',
    )
  })

  it('measures months from the anchor so the day never drifts', () => {
    const everyTwo = { unit: 'month', every: 2 } as const
    expect(iso(stepDue(anchor, everyTwo, 3))).toBe('2026-07-31')
  })
})

describe('approxCyclesBetween', () => {
  it('lands within one cycle of the truth', () => {
    const anchor = new Date(2026, 0, 1)
    const cadence = { unit: 'day', every: 28 } as const
    const n = approxCyclesBetween(anchor, new Date(2026, 5, 1), cadence)
    expect(n).toBe(5)
  })
})

describe('isValidInterval', () => {
  it('accepts 1 to 365 whole units', () => {
    expect(isValidInterval(1)).toBe(true)
    expect(isValidInterval(365)).toBe(true)
    expect(isValidInterval(0)).toBe(false)
    expect(isValidInterval(366)).toBe(false)
    expect(isValidInterval(2.5)).toBe(false)
  })
})
