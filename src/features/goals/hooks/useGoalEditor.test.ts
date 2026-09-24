import { describe, expect, it } from 'vitest'
import {
  incomeScheduleOf,
  parseSetAsideDay,
  shownNextPayday,
} from './useGoalEditor'

describe('parseSetAsideDay', () => {
  it('keeps a day from 1 to 28 and reads anything else as the default', () => {
    expect(parseSetAsideDay('5')).toBe(5)
    expect(parseSetAsideDay('28')).toBe(28)
    expect(parseSetAsideDay('')).toBeNull()
    expect(parseSetAsideDay('0')).toBeNull()
    expect(parseSetAsideDay('31')).toBeNull()
  })
})

describe('the income pay schedule', () => {
  const SEP_24 = new Date(2026, 8, 24)
  const draft = (
    over: Partial<Parameters<typeof incomeScheduleOf>[0]> = {},
  ) => ({
    day: '27',
    frequency: 'monthly' as const,
    anchorISO: '',
    storedAnchor: null,
    ...over,
  })

  it('saves a monthly stream as its day of the month alone', () => {
    expect(
      incomeScheduleOf(draft({ storedAnchor: '2026-12-27' }), SEP_24),
    ).toEqual({ day: 27, anchorDate: null })
  })

  it('offers the next computed payday until one is picked, and saves what it showed', () => {
    const quarterly = draft({ frequency: 'quarterly' })
    expect(shownNextPayday(quarterly, SEP_24)).toBe('2026-10-27')
    expect(incomeScheduleOf(quarterly, SEP_24)).toEqual({
      day: 27,
      anchorDate: '2026-10-27',
    })
  })

  it('saves a picked payday and takes its day of the month', () => {
    expect(
      incomeScheduleOf(
        draft({ frequency: 'annual', anchorISO: '2027-03-05' }),
        SEP_24,
      ),
    ).toEqual({ day: 5, anchorDate: '2027-03-05' })
  })

  it('keeps the stored anchor when the user leaves the payday alone', () => {
    const stored = draft({
      frequency: 'quarterly',
      day: '31',
      storedAnchor: '2026-01-31',
    })
    expect(shownNextPayday(stored, SEP_24)).toBe('2026-10-31')
    expect(incomeScheduleOf(stored, SEP_24)).toEqual({
      day: 31,
      anchorDate: '2026-01-31',
    })
  })
})
