import { describe, expect, it } from 'vitest'
import type { BillDraft } from '#/features/bills/data/mutations'
import type { GoalDraft } from '#/features/goals/data/mutations'
import { dateOf } from '#/features/planned/data/dates'
import {
  bill,
  budget,
  goal,
  income,
  m,
} from '#/features/planned/testing/fixtures'
import { scenario } from '#/features/planning/testing/state'
import type { Scenario } from '#/features/planning/testing/state'
import type { BudgetDraft } from '#/features/transactions/data/mutations'
import {
  comparePaycheck,
  knockOnLine,
  tryoutLine,
  tryoutProblem,
  whatIfHeadline,
} from '#/features/planning/view/whatIf'
import { inputsWith, whatIf } from './whatIf'
import type { WhatIfItem } from './whatIf'

const TODAY = '2026-10-10'
const SALARY = income({ id: 'pay', amount: m(10000), day: 25 })

const billDraft = (over: Partial<BillDraft> = {}): BillDraft => ({
  name: 'Car payment',
  amount: m(2000),
  currency: 'SAR',
  frequency: 'monthly',
  nextDue: '2026-11-01',
  walletId: null,
  categoryId: 'cat-car',
  color: '#123456',
  ...over,
})

const goalDraft = (over: Partial<GoalDraft> = {}): GoalDraft => ({
  name: 'Trip',
  currency: 'SAR',
  color: '#123456',
  target: m(6000),
  amount: null,
  dueDate: '2027-04-30',
  ...over,
})

const everydayDraft = (over: Partial<BudgetDraft> = {}): BudgetDraft => ({
  scopeType: 'category',
  categoryId: 'cat-groceries',
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: m(3000),
  currency: 'SAR',
  inPlan: true,
  ...over,
})

const tryBill = (over: Partial<BillDraft> = {}, on = true): WhatIfItem => ({
  id: 'try-bill',
  on,
  kind: 'bill',
  draft: billDraft(over),
})
const tryGoal = (over: Partial<GoalDraft> = {}): WhatIfItem => ({
  id: 'try-goal',
  on: true,
  kind: 'goal',
  draft: goalDraft(over),
})
const tryEveryday = (over: Partial<BudgetDraft> = {}): WhatIfItem => ({
  id: 'try-everyday',
  on: true,
  kind: 'everyday',
  draft: everydayDraft(over),
})

function run(s: Omit<Scenario, 'today'>, items: WhatIfItem[]) {
  const { inputs, state } = scenario({
    income: [SALARY],
    ...s,
    today: TODAY,
  })
  return {
    inputs,
    state,
    result: whatIf({ inputs, state, items, userId: 'u1', today: dateOf(TODAY) }),
  }
}

const CAL = { kind: 'paycheck', perYear: 12 } as never

describe('whatIf', () => {
  it('compares the plan with and without what is tried', () => {
    const { result } = run({}, [tryBill()])
    expect(result.before.paycheck.left).toBe(m(10000))
    expect(result.after.paycheck.bills.total).toBe(m(2000))
    expect(result.after.paycheck.left).toBe(m(8000))
    expect(result.after.verdict.kind).toBe('covered')
  })

  it('writes nothing: the plan it was given is unchanged', () => {
    const { inputs, state } = run({}, [tryBill()])
    expect(inputs.bills).toEqual([])
    expect(state.funding.tracks).toEqual([])
  })

  it('leaves out what is switched off', () => {
    const { result } = run({}, [tryBill({}, false)])
    expect(result.after.paycheck.left).toBe(m(10000))
    expect(result.items).toEqual([])
  })

  it('says when it doesn’t fit', () => {
    const { result } = run({}, [tryBill({ amount: m(12000) })])
    expect(result.after.verdict).toMatchObject({
      kind: 'short',
      per: 'paycheck',
      shortBy: m(2000),
    })
    expect(whatIfHeadline(result, 'SAR', CAL)).toMatchObject({
      tone: 'danger',
      title: 'You’d be short by SR 2,000 a paycheck',
    })
    expect(result.items[0].shortBy).toBe(m(2000))
    expect(tryoutProblem(result.items[0])).toBe('Short SR 2,000')
  })

  it('reads what a goal would ask for and when it gets there', () => {
    const { result } = run({}, [tryGoal()])
    const [outcome] = result.items
    expect(outcome.perPaycheck).toBeGreaterThan(0)
    expect(outcome.shortBy).toBe(0)
    expect(outcome.finish).not.toBeNull()
    expect(whatIfHeadline(result, 'SAR', CAL).title).toBe(
      'Yes, you can fit this',
    )
  })

  it('reads a new everyday estimate per paycheck', () => {
    const { result } = run({}, [tryEveryday()])
    expect(result.after.paycheck.everyday.total).toBe(m(3000))
    expect(result.items[0]).toMatchObject({
      perPaycheck: m(3000),
      currency: 'SAR',
    })
  })

  it('replaces a category’s budget instead of counting it twice', () => {
    const { inputs, result } = run({ budgets: [budget()] }, [tryEveryday()])
    expect(result.before.paycheck.everyday.total).toBe(m(2000))
    expect(result.after.paycheck.everyday.total).toBe(m(3000))
    expect(inputsWith(inputs, [tryEveryday()]).budgets).toHaveLength(1)
  })
})

describe('what else would change', () => {
  it('names a goal that gets less each paycheck', () => {
    const fund = goal({
      id: 'fund',
      name: 'Savings',
      target: null,
      amount: m(9000),
      dueDate: null,
    })
    const { result } = run({ goals: [fund] }, [tryBill({ amount: m(5000) })])
    expect(result.knockOns).toEqual([
      expect.objectContaining({
        id: 'fund',
        change: 'slower',
        from: m(9000),
        to: m(5000),
      }),
    ])
    expect(knockOnLine(result.knockOns[0], CAL)).toBe(
      'Savings would get SR 5,000 a paycheck, not SR 9,000.',
    )
  })

  it('names a dated goal that would miss its date', () => {
    const trip = goal({
      id: 'trip',
      name: 'Trip',
      target: m(20000),
      amount: null,
      dueDate: '2026-12-31',
    })
    const { result } = run({ goals: [trip] }, [tryBill({ amount: m(9000) })])
    expect(result.before.verdict.kind).not.toBe('short')
    expect(result.knockOns[0]).toMatchObject({ id: 'trip', change: 'short' })
  })

  it('names nothing when the rest of the plan is untouched', () => {
    const rent = bill({ id: 'rent', amount: m(2000), nextDue: '2026-11-01' })
    const { result } = run({ bills: [rent] }, [tryBill()])
    expect(result.knockOns).toEqual([])
  })
})

describe('the words and the comparison', () => {
  it('puts both paychecks on one scale', () => {
    const { result, state } = run({}, [tryBill({ amount: m(12000) })])
    const compare = comparePaycheck(
      result.before.paycheck,
      result.after.paycheck,
      'SAR',
      state.funding.calendar,
    )
    expect(compare.bars.map((b) => b.label)).toEqual(['Now', 'With this'])
    expect(compare.payAt).toBeCloseTo((10000 / 12000) * 100)
    const bills = compare.rows.find((r) => r.key === 'bills')
    expect(bills).toMatchObject({ now: 0, then: m(12000) })
  })

  it('says a bill due before payday comes from what is free', () => {
    const item = tryBill({ nextDue: '2026-10-12', frequency: null })
    const { result } = run({}, [item])
    expect(tryoutLine(item, result.items[0], CAL)).toBe(
      'Bill · due before your next paycheck, from what’s free',
    )
  })

  it('marks a switched-off item as left out', () => {
    expect(tryoutLine(tryBill({}, false), undefined, CAL)).toBe(
      'Bill · left out',
    )
  })
})
