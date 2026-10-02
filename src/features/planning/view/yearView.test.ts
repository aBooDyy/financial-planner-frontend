import { describe, expect, it } from 'vitest'
import type { YearMonth } from '#/features/planning/data/yearAhead'
import { monthHead, monthIndex } from './yearView'

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
