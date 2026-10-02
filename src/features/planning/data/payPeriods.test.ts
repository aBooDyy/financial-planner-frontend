import { describe, expect, it } from 'vitest'
import { DEFAULT_PLANNING_SETTINGS } from '#/features/wallets/api/types'
import type { PlanningSettings } from '#/features/wallets/api/types'
import { RATES, income, m } from '#/features/planned/testing/fixtures'
import {
  incomeBetween,
  mainPaycheckOf,
  payCalendarOf,
  paydayAfter,
  paydaysIn,
  perPaycheck,
  periodOf,
  periodsBetween,
  safeHorizonEnd,
} from './payPeriods'

const TODAY = '2026-10-02'
const settings = (over: Partial<PlanningSettings> = {}): PlanningSettings => ({
  ...DEFAULT_PLANNING_SETTINGS,
  ...over,
})

const SALARY = income({ id: 'salary', amount: m(12000), day: 25 })
const SIDE = income({ id: 'side', amount: m(1500), day: 10, position: 1 })
const WEEKLY = income({
  id: 'weekly',
  amount: m(1000),
  frequency: 'weekly',
  anchorDate: '2026-10-02',
  day: 2,
})

describe('the main paycheck', () => {
  it('is the largest stream by monthly amount', () => {
    expect(
      mainPaycheckOf([SIDE, SALARY], settings(), 'SAR', RATES, TODAY)?.id,
    ).toBe('salary')
    // 1,000 a week is about 4,333 a month: more than the side gig, less than the salary.
    expect(
      mainPaycheckOf([SIDE, WEEKLY], settings(), 'SAR', RATES, TODAY)?.id,
    ).toBe('weekly')
  })

  it('is the one the user picked, while it is active', () => {
    const picked = settings({ mainIncomeStreamId: 'side' })
    expect(
      mainPaycheckOf([SIDE, SALARY], picked, 'SAR', RATES, TODAY)?.id,
    ).toBe('side')
    const ended = { ...SIDE, endsOn: '2026-09-30' }
    expect(
      mainPaycheckOf([ended, SALARY], picked, 'SAR', RATES, TODAY)?.id,
    ).toBe('salary')
  })

  it('does not exist while income varies or with no income', () => {
    expect(
      mainPaycheckOf(
        [SALARY],
        settings({ incomeVaries: true }),
        'SAR',
        RATES,
        TODAY,
      ),
    ).toBeNull()
    expect(mainPaycheckOf([], settings(), 'SAR', RATES, TODAY)).toBeNull()
  })
})

describe('pay periods', () => {
  const cal = payCalendarOf([SALARY], settings(), 'SAR', RATES, TODAY)

  it('run from one main payday to the day before the next', () => {
    expect(periodOf(cal, TODAY)).toEqual({
      start: '2026-09-25',
      end: '2026-10-24',
    })
    // A payday opens its own period.
    expect(periodOf(cal, '2026-10-25')).toEqual({
      start: '2026-10-25',
      end: '2026-11-24',
    })
    expect(paydayAfter(cal, TODAY)).toBe('2026-10-25')
  })

  it('list consecutive periods across a range', () => {
    expect(
      periodsBetween(cal, TODAY, '2026-12-01').map((p) => p.start),
    ).toEqual(['2026-09-25', '2026-10-25', '2026-11-25'])
  })

  it('fall back to calendar months with no income, or when income varies', () => {
    for (const month of [
      payCalendarOf([], settings(), 'SAR', RATES, TODAY),
      payCalendarOf(
        [SALARY],
        settings({ incomeVaries: true }),
        'SAR',
        RATES,
        TODAY,
      ),
    ]) {
      expect(month.kind).toBe('month')
      expect(periodOf(month, TODAY)).toEqual({
        start: '2026-10-01',
        end: '2026-10-31',
      })
      expect(paydaysIn(month, TODAY, '2026-12-31')).toEqual([
        '2026-11-01',
        '2026-12-01',
      ])
    }
  })

  it('spread a monthly amount over the paychecks a year has', () => {
    const weekly = payCalendarOf([WEEKLY], settings(), 'SAR', RATES, TODAY)
    expect(perPaycheck(m(5200), cal)).toBe(m(5200))
    expect(perPaycheck(m(5200), weekly)).toBe(m(1200))
  })
})

describe('income between two dates', () => {
  it('counts each payday once and stops after a stream ends', () => {
    expect(
      incomeBetween([SALARY, SIDE], '2026-10-01', '2026-11-30', 'SAR', RATES),
    ).toBe(m(2 * 12000 + 2 * 1500))
    const ending = { ...SIDE, endsOn: '2026-10-31' }
    expect(
      incomeBetween([ending], '2026-10-01', '2026-11-30', 'SAR', RATES),
    ).toBe(m(1500))
  })
})

describe('the safe-to-spend horizon', () => {
  const cal = payCalendarOf([SALARY], settings(), 'SAR', RATES, TODAY)
  const month = payCalendarOf([], settings(), 'SAR', RATES, TODAY)

  it('defaults to the day before the next main payday', () => {
    expect(safeHorizonEnd(settings(), cal, TODAY)).toBe('2026-10-24')
  })

  it('falls back to 30 days without a reliable payday', () => {
    expect(safeHorizonEnd(settings(), month, TODAY)).toBe('2026-11-01')
  })

  it('can be the end of the month or the next N days', () => {
    expect(
      safeHorizonEnd(settings({ safeHorizon: 'end_of_month' }), cal, TODAY),
    ).toBe('2026-10-31')
    expect(
      safeHorizonEnd(
        settings({ safeHorizon: 'days', safeHorizonDays: 14 }),
        cal,
        TODAY,
      ),
    ).toBe('2026-10-16')
  })
})
