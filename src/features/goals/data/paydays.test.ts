import { describe, expect, it } from 'vitest'
import { nextPaydayOf, paydaysOf } from './paydays'
import { ymd } from './planning'

const SEP_24 = new Date(2026, 8, 24)

describe('paydaysOf — anchored', () => {
  it('lands a quarterly payday in the anchor’s own months', () => {
    expect(
      paydaysOf(
        { day: 27, frequency: 'quarterly', anchorDate: '2026-12-27' },
        '2026-09-24',
        '2027-09-24',
      ),
    ).toEqual(['2026-09-27', '2026-12-27', '2027-03-27', '2027-06-27'])
  })

  it('steps back from a future anchor as well as forward', () => {
    expect(
      paydaysOf(
        { day: 15, frequency: 'semi', anchorDate: '2027-03-15' },
        '2026-09-01',
        '2027-10-01',
      ),
    ).toEqual(['2026-09-15', '2027-03-15', '2027-09-15'])
  })

  it('clamps a stepped month to its length without drifting', () => {
    expect(
      paydaysOf(
        { day: 31, frequency: 'quarterly', anchorDate: '2026-01-31' },
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31'])
    expect(
      paydaysOf(
        { day: 29, frequency: 'annual', anchorDate: '2024-02-29' },
        '2025-01-01',
        '2028-12-31',
      ),
    ).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })

  it('steps a weekly stream seven days from its anchor', () => {
    expect(
      paydaysOf(
        { day: 1, frequency: 'weekly', anchorDate: '2026-10-02' },
        '2026-09-24',
        '2026-10-20',
      ),
    ).toEqual(['2026-09-25', '2026-10-02', '2026-10-09', '2026-10-16'])
  })

  it('pays a monthly stream on its day of the month, whatever the anchor', () => {
    expect(
      paydaysOf(
        { day: 27, frequency: 'monthly', anchorDate: '2026-10-05' },
        '2026-09-24',
        '2026-11-30',
      ),
    ).toEqual(['2026-09-27', '2026-10-27', '2026-11-27'])
  })
})

describe('paydaysOf — no anchor', () => {
  it('keeps the fixed calendar months for longer cadences', () => {
    expect(
      paydaysOf(
        { day: 15, frequency: 'quarterly' },
        '2026-09-24',
        '2027-09-24',
      ),
    ).toEqual(['2026-10-15', '2027-01-15', '2027-04-15', '2027-07-15'])
    expect(
      paydaysOf(
        { day: 15, frequency: 'quarterly', anchorDate: 'not-a-date' },
        '2026-09-24',
        '2027-01-31',
      ),
    ).toEqual(['2026-10-15', '2027-01-15'])
  })

  it('returns nothing for an empty range', () => {
    expect(
      paydaysOf({ day: 1, frequency: 'monthly' }, '2026-10-01', '2026-09-01'),
    ).toEqual([])
  })
})

describe('nextPaydayOf', () => {
  it('is the first payday on or after today', () => {
    expect(ymd(nextPaydayOf({ day: 24, frequency: 'monthly' }, SEP_24))).toBe(
      '2026-09-24',
    )
    expect(ymd(nextPaydayOf({ day: 31, frequency: 'monthly' }, SEP_24))).toBe(
      '2026-09-30',
    )
    expect(
      ymd(
        nextPaydayOf(
          { day: 27, frequency: 'annual', anchorDate: '2025-03-27' },
          SEP_24,
        ),
      ),
    ).toBe('2027-03-27')
  })
})
