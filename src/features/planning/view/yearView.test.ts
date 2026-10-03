import { describe, expect, it } from 'vitest'
import type { YearMonth } from '#/features/planning/data/yearAhead'
import { bill, m } from '#/features/planned/testing/fixtures'
import { monthHead, monthIndex, monthlyBillLanes } from './yearView'

const month = (m: string): YearMonth => ({
  month: m,
  income: 0,
  monthlyBills: { total: 0, items: [] },
  bigBills: [],
  goalTargets: [],
  setAside: { total: 0, byOwner: [] },
})

const months = ['2026-11', '2026-12', '2027-01', '2027-02'].map(month)

describe('year ahead columns', () => {
  it('places a date in its month, before or after the window', () => {
    expect(monthIndex(months, '2026-12-15')).toBe(1)
    expect(monthIndex(months, '2026-10-30')).toBe(-1)
    expect(monthIndex(months, '2027-06-01')).toBe(4)
  })

  it('names the year under the first month and every January', () => {
    expect(monthHead(months, 0)).toEqual({ name: 'Nov', year: '2026' })
    expect(monthHead(months, 1)).toEqual({ name: 'Dec', year: null })
    expect(monthHead(months, 2)).toEqual({ name: 'Jan', year: '2027' })
  })
})

describe('monthly bill lanes', () => {
  it('gives each bill covered from a paycheck its dates in each month', () => {
    const gym = bill({
      id: 'gym',
      name: 'Gym',
      amount: m(50),
      frequency: 'weekly',
    })
    const line = (occurrence: string) => ({
      billId: 'gym',
      occurrence,
      amount: m(50),
      amountBase: m(50),
    })
    const withGym = months.map((mo) => ({ ...mo }))
    withGym[0] = {
      ...withGym[0],
      monthlyBills: {
        total: m(100),
        items: [line('2026-11-03'), line('2026-11-10')],
      },
    }
    withGym[2] = {
      ...withGym[2],
      monthlyBills: { total: m(50), items: [line('2027-01-05')] },
    }
    const lanes = monthlyBillLanes({ months: withGym, ramps: [], goals: [] }, [
      gym,
    ])
    expect(lanes).toEqual([
      {
        billId: 'gym',
        name: 'Gym',
        color: gym.color,
        sub: 'Weekly · SR 50',
        dates: [['Nov 3', 'Nov 10'], [], ['Jan 5'], []],
      },
    ])
  })
})
