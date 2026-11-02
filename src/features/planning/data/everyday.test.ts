import { describe, expect, it } from 'vitest'
import {
  bill,
  budget,
  goal,
  income,
  m,
  RATES,
  tx,
} from '#/features/planned/testing/fixtures'
import { scenario } from '#/features/planning/testing/state'
import { averageMonthlySpend, isPlannedBudget, perSlotOf } from './everyday'
import { eachPaycheck, verdictOf } from './paycheck'
import { tracksOf } from './funding'
import type { PayCalendar } from './payPeriods'
import { buildUpcoming } from './upcoming'

const TODAY = '2026-10-10'
const SALARY = income({ id: 'pay', amount: m(10000), day: 25 })

const MONTHLY = { perYear: 12 } as PayCalendar
const BIWEEKLY = { perYear: 26 } as PayCalendar

describe('which budgets count', () => {
  it('counts only a live category budget switched on', () => {
    expect(isPlannedBudget(budget())).toBe(true)
    expect(isPlannedBudget(budget({ inPlan: false }))).toBe(false)
    expect(isPlannedBudget(budget({ inPlan: undefined }))).toBe(false)
    expect(isPlannedBudget(budget({ scopeType: 'overall' }))).toBe(false)
    expect(isPlannedBudget(budget({ deleted: 1 }))).toBe(false)
    expect(isPlannedBudget(budget({ limit: 0 }))).toBe(false)
  })
})

describe('what it takes from a paycheck', () => {
  it('spreads each period over the pay calendar', () => {
    const monthly = { period: 'monthly', customDays: null } as const
    const weekly = { period: 'weekly', customDays: null } as const
    const paycheck = { period: 'paycheck', customDays: null } as const
    expect(perSlotOf(m(2000), monthly, MONTHLY)).toBe(m(2000))
    expect(perSlotOf(m(2600), monthly, BIWEEKLY)).toBeCloseTo(m(1200))
    expect(perSlotOf(m(500), paycheck, BIWEEKLY)).toBe(m(500))
    expect(perSlotOf(m(100), weekly, MONTHLY)).toBeCloseTo(m(434.82), 0)
  })

  it('reads a custom period by its length', () => {
    const fortnight = { period: 'custom', customDays: 14 } as const
    expect(perSlotOf(m(100), fortnight, MONTHLY)).toBeCloseTo(m(217.41), 0)
  })
})

describe('in the plan', () => {
  it('comes off the paycheck and out of what is left', () => {
    const { inputs, state } = scenario({
      income: [SALARY],
      budgets: [budget()],
      today: TODAY,
    })
    const p = eachPaycheck(inputs, state)
    expect(p.everyday.total).toBe(m(2000))
    expect(p.planned).toBe(m(2000))
    expect(p.left).toBe(m(8000))
  })

  it('counts as a plan on its own', () => {
    const { inputs, state } = scenario({
      income: [SALARY],
      budgets: [budget()],
      today: TODAY,
    })
    expect(verdictOf(inputs, state).kind).toBe('covered')
  })

  it('reads short when pay can’t carry it', () => {
    const { inputs, state } = scenario({
      income: [SALARY],
      bills: [bill({ id: 'rent', amount: m(9000), nextDue: '2026-11-01' })],
      budgets: [budget()],
      today: TODAY,
    })
    expect(verdictOf(inputs, state)).toMatchObject({
      kind: 'short',
      per: 'paycheck',
      shortBy: m(1000),
    })
  })

  it('stays out of the plan while switched off', () => {
    const { inputs, state } = scenario({
      income: [SALARY],
      budgets: [budget({ inPlan: false })],
      today: TODAY,
    })
    expect(eachPaycheck(inputs, state).left).toBe(m(10000))
    expect(verdictOf(inputs, state)).toEqual({ kind: 'start', reason: 'empty' })
  })
})

describe('funding order', () => {
  it('is covered after must-pay bills and before goals', () => {
    const rent = bill({ id: 'rent', amount: m(6000), nextDue: '2026-11-01' })
    const car = goal({
      id: 'car',
      target: null,
      amount: m(5000),
      dueDate: null,
      mustHave: true,
    })
    const { state } = scenario({
      income: [SALARY],
      bills: [rent],
      goals: [car],
      budgets: [budget()],
      today: TODAY,
    })
    const [rentTrack] = tracksOf(state.funding, 'bill', 'rent')
    const [carTrack] = tracksOf(state.funding, 'goal', 'car')
    expect(rentTrack.funded[0]).toBe(m(6000))
    // 10,000 pay − 6,000 rent − 2,000 everyday.
    expect(carTrack.funded[0]).toBe(m(2000))
    expect(carTrack.required[0]).toBe(m(5000))
  })

  it('never takes a must-pay bill’s money', () => {
    const rent = bill({ id: 'rent', amount: m(9500), nextDue: '2026-11-01' })
    const { state } = scenario({
      income: [SALARY],
      bills: [rent],
      budgets: [budget()],
      today: TODAY,
    })
    expect(tracksOf(state.funding, 'bill', 'rent')[0].shortfall).toBe(0)
  })

  it('leaves the funding as it was with no everyday spending', () => {
    const car = goal({ id: 'car', target: null, amount: m(9000), dueDate: null })
    const { state } = scenario({
      income: [SALARY],
      goals: [car],
      today: TODAY,
    })
    expect(state.funding.everydayPerSlot).toBe(0)
    expect(tracksOf(state.funding, 'goal', 'car')[0].funded[0]).toBe(m(9000))
  })
})

describe('on Upcoming', () => {
  it('comes out of what a period leaves for spending', () => {
    const { inputs, state } = scenario({
      income: [SALARY],
      budgets: [budget()],
      today: TODAY,
    })
    const view = buildUpcoming({ inputs, state, nodes: [], today: TODAY })
    expect(view.periods.every((p) => p.everyday === m(2000))).toBe(true)
  })
})

describe('the recent average', () => {
  const base = {
    rootOf: (c: string) => (c === 'cat-veg' ? 'cat-groceries' : c),
    rootId: 'cat-groceries',
    currency: 'SAR' as const,
    rates: RATES,
    today: TODAY,
  }
  const spend = (date: string, amount: number, over = {}) =>
    tx({
      date,
      amount: m(amount),
      type: 'spend',
      categoryId: 'cat-groceries',
      ...over,
    })

  it('averages the months with spending, subcategories included', () => {
    expect(
      averageMonthlySpend({
        ...base,
        txns: [
          spend('2026-08-05', 1000),
          spend('2026-09-05', 1500),
          spend('2026-09-20', 500, { categoryId: 'cat-veg' }),
        ],
      }),
    ).toBe(m(1500))
  })

  it('leaves out this month, bills and other categories', () => {
    expect(
      averageMonthlySpend({
        ...base,
        txns: [
          spend('2026-10-02', 900),
          spend('2026-09-02', 900, { billId: 'rent' }),
          spend('2026-09-03', 900, { categoryId: 'cat-fuel' }),
          spend('2026-06-03', 900),
        ],
      }),
    ).toBeNull()
  })
})
