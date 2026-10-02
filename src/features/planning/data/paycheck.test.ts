import { describe, expect, it } from 'vitest'
import { bill, goal, income, m } from '#/features/planned/testing/fixtures'
import { scenario } from '#/features/planning/testing/state'
import type { Scenario } from '#/features/planning/testing/state'
import { eachPaycheck, needsDecision, verdictOf } from './paycheck'

const TODAY = '2026-10-02'
/** SR 12,000 on the 25th. */
const SALARY = income({ id: 'salary', amount: m(12000), day: 25 })

const BILLS = [
  bill({ id: 'rent', amount: m(3000), nextDue: '2026-11-01' }),
  bill({ id: 'internet', amount: m(200), nextDue: '2026-11-05' }),
  bill({
    id: 'ins',
    amount: m(1200),
    frequency: 'annual',
    nextDue: '2027-03-01',
  }),
]
const GOALS = [
  goal({ id: 'emergency', amount: m(800), mustHave: true }),
  goal({ id: 'umrah', target: m(7500), dueDate: '2027-02-28' }),
]

const run = (s: Partial<Scenario> = {}) => {
  const { inputs, state } = scenario({
    income: [SALARY],
    bills: BILLS,
    goals: GOALS,
    today: TODAY,
    ...s,
  })
  const paycheck = eachPaycheck(inputs, state)
  return { paycheck, verdict: verdictOf(inputs, state, paycheck), state }
}

describe('eachPaycheck', () => {
  it('splits the next paycheck into monthly bills, saving up, goals and what is left', () => {
    const { paycheck } = run()
    expect(paycheck).toMatchObject({
      payday: '2026-10-25',
      income: m(12000),
      bills: { total: m(3200), count: 2 },
      // 1,200 over Oct 25 … Feb 25.
      savingUp: { total: m(240), count: 1 },
      // 800 a paycheck + 7,500 over five paydays.
      goals: { total: m(800 + 1500), count: 2 },
      planned: m(3200 + 240 + 2300),
      left: m(12000 - 5740),
    })
  })

  it('lets what is left go negative instead of hiding a shortfall', () => {
    const { paycheck, verdict } = run({
      goals: [
        ...GOALS,
        goal({ id: 'car', target: m(40000), dueDate: '2027-02-28' }),
      ],
    })
    expect(paycheck.left).toBe(m(12000 - 5740 - 8000))
    expect(verdict).toEqual({
      kind: 'short',
      per: 'paycheck',
      shortBy: m(1740),
      left: -m(1740),
    })
  })
})

describe('verdictOf', () => {
  it('is covered with room to spare', () => {
    expect(run().verdict).toEqual({ kind: 'covered', left: m(6260) })
  })

  it('is tight when under a tenth of pay is left', () => {
    const { verdict } = run({
      goals: [
        ...GOALS,
        goal({ id: 'car', target: m(27500), dueDate: '2027-02-28' }),
      ],
    })
    // 27,500 over five paydays = 5,500: 760 left of 12,000.
    expect(verdict).toEqual({ kind: 'tight', left: m(760) })
  })

  it('is short in total when a date can’t be met though this paycheck fits', () => {
    // A quarterly bonus lands before Oct 25's period ends; the next period has salary only.
    const bonus = income({
      id: 'bonus',
      amount: m(5000),
      frequency: 'quarterly',
      day: 30,
      anchorDate: '2026-10-30',
    })
    const tuition = bill({
      id: 'tuition',
      amount: m(26000),
      frequency: null,
      nextDue: '2026-11-30',
    })
    const { verdict, state } = run({
      income: [SALARY, bonus],
      bills: [tuition],
      goals: [],
    })
    // 13,000 a payday is needed; 17,000 lands now, 12,000 next time: 1,000 short.
    expect(verdict).toEqual({
      kind: 'short',
      per: 'total',
      shortBy: m(1000),
      left: m(4000),
    })
    expect(needsDecision(state)).toEqual([
      {
        kind: 'bill',
        ownerId: 'tuition',
        occurrence: '2026-11-30',
        shortBy: m(1000),
        requiredPerPaycheck: m(13000),
        deadline: '2026-11-30',
        pushOutTo: null,
      },
    ])
  })

  it('asks to start the plan when nothing is planned, or for income when there is none', () => {
    expect(run({ bills: [], goals: [] }).verdict).toEqual({
      kind: 'start',
      reason: 'empty',
    })
    expect(run({ income: [] }).verdict).toEqual({
      kind: 'start',
      reason: 'no_income',
    })
  })
})

describe('needsDecision', () => {
  it('lists goals that won’t make their date, with a later date to push to', () => {
    const { state } = run({
      goals: [goal({ id: 'car', target: m(90000), dueDate: '2027-01-15' })],
      bills: [],
    })
    expect(needsDecision(state)).toEqual([
      expect.objectContaining({
        kind: 'goal',
        ownerId: 'car',
        shortBy: m(90000 - 36000),
        pushOutTo: '2027-07-15',
      }),
    ])
  })

  it('leaves out a bill due before the next payday: it is paid from free money', () => {
    const { state } = run({
      bills: [bill({ id: 'phone', amount: m(150), nextDue: '2026-10-12' })],
      goals: [],
    })
    expect(needsDecision(state)).toEqual([])
  })
})
