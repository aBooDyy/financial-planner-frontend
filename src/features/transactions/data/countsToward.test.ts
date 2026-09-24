import { describe, expect, it } from 'vitest'
import { goal, income, m, planned } from '#/features/planned/testing/fixtures'
import {
  goalOption,
  isSavingGoal,
  rankGoalOptions,
  rankIncomeOptions,
  TOP_OPTIONS,
} from './countsToward'

const DATE = '2026-09-24'

describe('goalOption', () => {
  it('describes a saving goal by saved of target', () => {
    const g = goal({ name: 'Umrah trip', target: m(13000) })
    expect(goalOption(g, m(4000)).sub).toBe('Goal · SR 4,000 of SR 13,000')
    expect(goalOption(g, 0).kind).toBe('goal')
  })

  it('describes an obligation by its amount and next due', () => {
    const rent = goal({
      name: 'Rent',
      kind: 'recurring',
      amount: m(3500),
      nextDue: '2026-10-01',
    })
    expect(goalOption(rent, 0)).toMatchObject({
      kind: 'obligation',
      sub: 'Obligation · SR 3,500 due Oct 1',
    })
    expect(isSavingGoal(rent)).toBe(false)
  })

  it('falls back to "saved" for an open-ended goal', () => {
    const g = goal({ kind: 'openended', target: null })
    expect(goalOption(g, m(250)).sub).toBe('Goal · SR 250 saved')
  })
})

describe('rankGoalOptions', () => {
  const goals = Array.from({ length: 7 }, (_, i) =>
    goal({ id: `g${i}`, name: `G${i}`, position: i }),
  )

  it('puts goals with an open planned item near the date first, nearest first', () => {
    const { top } = rankGoalOptions({
      goals,
      planned: [
        planned({ goalId: 'g5', occurrence: '2026-10-10' }),
        planned({ goalId: 'g6', occurrence: '2026-09-20' }),
        planned({ goalId: 'g4', occurrence: '2026-12-01' }), // too far
        planned({ goalId: 'g3', occurrence: '2026-09-24', status: 'done' }),
      ],
      date: DATE,
      savedOf: () => 0,
      selectedId: null,
    })
    expect(top.map((o) => o.id)).toEqual(['g6', 'g5', 'g0', 'g1', 'g2'])
  })

  it('ranks a payment due soon over set-asides due sooner, then obligations over saving goals', () => {
    const rent = goal({
      id: 'rent',
      kind: 'recurring',
      amount: m(3500),
      position: 7,
    })
    const gym = goal({
      id: 'gym',
      kind: 'recurring',
      amount: m(200),
      position: 8,
    })
    const { top, rest } = rankGoalOptions({
      goals: [...goals, rent, gym],
      planned: [
        ...goals.map((g) =>
          planned({
            goalId: g.id,
            role: 'set_aside',
            occurrence: '2026-09-25',
          }),
        ),
        planned({ goalId: 'g3', role: 'set_aside', occurrence: '2026-09-24' }),
        planned({ goalId: 'rent', role: 'payment', occurrence: '2026-10-01' }),
      ],
      date: DATE,
      savedOf: () => 0,
      selectedId: null,
    })
    expect(top.map((o) => o.id)).toEqual(['rent', 'gym', 'g3', 'g0', 'g1'])
    expect(rest.map((o) => o.id)).toEqual(['g2', 'g4', 'g5', 'g6'])
  })

  it('shows at most five, and always the chosen one', () => {
    const plain = rankGoalOptions({
      goals,
      planned: [],
      date: DATE,
      savedOf: () => 0,
      selectedId: null,
    })
    expect(plain.top).toHaveLength(TOP_OPTIONS)
    expect(plain.rest.map((o) => o.id)).toEqual(['g5', 'g6'])

    const chosen = rankGoalOptions({
      goals,
      planned: [],
      date: DATE,
      savedOf: () => 0,
      selectedId: 'g6',
    })
    expect(chosen.top.map((o) => o.id)).toContain('g6')
    expect(chosen.rest.map((o) => o.id)).toEqual(['g5'])
  })

  it('leaves deleted goals out', () => {
    const { top } = rankGoalOptions({
      goals: [goal({ id: 'gone', deleted: 1 }), goal({ id: 'kept' })],
      planned: [],
      date: DATE,
      savedOf: () => 0,
      selectedId: null,
    })
    expect(top.map((o) => o.id)).toEqual(['kept'])
  })
})

describe('rankIncomeOptions', () => {
  it('lists streams, the one with a payday near the date first', () => {
    const salary = income({
      id: 's1',
      label: 'Salary',
      amount: m(12000),
      position: 1,
    })
    const rent = income({
      id: 's2',
      label: 'Rental',
      amount: m(2000),
      position: 0,
    })
    const { top } = rankIncomeOptions({
      streams: [rent, salary],
      planned: [
        planned({
          role: 'income',
          origin: 'income',
          goalId: null,
          incomeStreamId: 's1',
          occurrence: '2026-09-27',
        }),
      ],
      date: DATE,
      selectedId: null,
    })
    expect(top.map((o) => o.id)).toEqual(['s1', 's2'])
    expect(top[0]).toMatchObject({
      kind: 'income',
      sub: 'Income · SR 12,000 monthly',
    })
  })
})
