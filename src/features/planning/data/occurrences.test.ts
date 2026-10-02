import { describe, expect, it } from 'vitest'
import type { GoalFrequency, IntervalUnit } from '#/features/goals/api/types'
import { bill, planned } from '#/features/planned/testing/fixtures'
import {
  billOccurrences,
  firstOpenOccurrence,
  openOccurrences,
  paymentRowsOf,
  stepOccurrence,
} from './occurrences'

const preset = (frequency: GoalFrequency) => ({
  frequency,
  customInterval: null,
  customUnit: null,
})
const every = (customInterval: number, customUnit: IntervalUnit) => ({
  frequency: 'custom' as const,
  customInterval,
  customUnit,
})

describe('stepOccurrence', () => {
  it('steps each cadence forward', () => {
    const at = '2026-06-20'
    expect(stepOccurrence(at, preset('weekly'), 1)).toBe('2026-06-27')
    expect(stepOccurrence(at, preset('monthly'), 1)).toBe('2026-07-20')
    expect(stepOccurrence(at, preset('quarterly'), 1)).toBe('2026-09-20')
    expect(stepOccurrence(at, preset('semi'), 1)).toBe('2026-12-20')
    expect(stepOccurrence(at, preset('annual'), 1)).toBe('2027-06-20')
    expect(stepOccurrence(at, preset('monthly'), -1)).toBe('2026-05-20')
  })

  it('steps a custom interval in its unit', () => {
    const at = '2026-06-20'
    expect(stepOccurrence(at, every(28, 'day'), 1)).toBe('2026-07-18')
    expect(stepOccurrence(at, every(2, 'week'), 1)).toBe('2026-07-04')
    expect(stepOccurrence(at, every(2, 'month'), 1)).toBe('2026-08-20')
  })

  it('keeps a month-end day, clamped to short months', () => {
    expect(
      [1, 2, 3].map((n) => stepOccurrence('2026-01-31', preset('monthly'), n)),
    ).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })
})

describe('a bill’s occurrences', () => {
  const rent = bill({ id: 'rent', nextDue: '2026-10-01' })

  it('run from next due to the end date, none once closed, one for a one-off', () => {
    expect(
      billOccurrences({ ...rent, endsOn: '2026-12-15' }, '2027-06-01'),
    ).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
    expect(
      billOccurrences({ ...rent, closedAt: '2026-09-01' }, '2027-06-01'),
    ).toEqual([])
    expect(billOccurrences({ ...rent, frequency: null }, '2027-06-01')).toEqual(
      ['2026-10-01'],
    )
  })

  it('are settled by a payment row that is no longer open', () => {
    const rows = paymentRowsOf('rent', [
      planned({
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-10-01',
        status: 'done',
      }),
      planned({
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-11-01',
        status: 'skipped',
      }),
      planned({
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        occurrence: '2026-12-01',
      }),
    ])
    expect(firstOpenOccurrence(rent, rows)).toBe('2026-12-01')
    expect(openOccurrences(rent, rows, '2027-01-31')).toEqual([
      '2026-12-01',
      '2027-01-01',
    ])
  })
})
