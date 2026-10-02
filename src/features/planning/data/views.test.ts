import { describe, expect, it } from 'vitest'
import {
  RATES,
  bill,
  goal,
  income,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { plannedScenario } from '#/features/planning/testing/state'
import type { Scenario } from '#/features/planning/testing/state'
import {
  paydayReview,
  reviewCount,
  transfersFor,
  waitingReviews,
} from './review'
import { buildUpcoming } from './upcoming'
import { buildYearAhead } from './yearAhead'

/** SR 12,000 on the 25th into Main bank. */
const SALARY = income({
  id: 'salary',
  amount: m(12000),
  day: 25,
  walletId: 'main',
})
const RENT = bill({
  id: 'rent',
  name: 'Rent',
  amount: m(3000),
  nextDue: '2026-11-01',
  walletId: 'main',
})
const INTERNET = bill({
  id: 'internet',
  name: 'Internet',
  amount: m(200),
  nextDue: '2026-11-05',
  walletId: 'main',
})
const INSURANCE = bill({
  id: 'ins',
  name: 'Car insurance',
  amount: m(1200),
  frequency: 'annual',
  nextDue: '2027-03-01',
  walletId: 'main',
})
const EMERGENCY = goal({
  id: 'emergency',
  name: 'Emergency fund',
  amount: m(800),
  mustHave: true,
  saveWalletId: 'savings',
})
const UMRAH = goal({
  id: 'umrah',
  name: 'Umrah trip',
  target: m(7500),
  dueDate: '2027-02-28',
  saveWalletId: 'savings',
})

const world = (over: Partial<Scenario> = {}) =>
  plannedScenario({
    income: [SALARY],
    bills: [RENT, INTERNET, INSURANCE],
    goals: [EMERGENCY, UMRAH],
    today: '2026-10-25',
    ...over,
  })

const CURRENCIES = new Map([
  ['main', 'SAR'],
  ['savings', 'SAR'],
])

describe('the payday review', () => {
  it('groups the payday’s set-asides: bills before next payday, saving up, goals', () => {
    const { inputs, state, today } = world()
    const review = paydayReview(inputs, state, '2026-10-25', {
      today,
      walletCurrency: CURRENCIES,
    })
    expect(review.period).toEqual({ start: '2026-10-25', end: '2026-11-24' })
    expect(review.depositWalletId).toBe('main')
    expect(
      review.groups.map((g) => [
        g.key,
        g.lines.map((l) => [l.name, l.amount / 100]),
        g.total / 100,
      ]),
    ).toEqual([
      [
        'bills_before_payday',
        [
          ['Rent', 3000],
          ['Internet', 200],
        ],
        3200,
      ],
      ['saving_up', [['Car insurance', 240]], 240],
      // The must-have goal comes first.
      [
        'goals',
        [
          ['Emergency fund', 800],
          ['Umrah trip', 1500],
        ],
        2300,
      ],
    ])
    expect(review.total).toBe(m(5740))
    // Both goals go to Savings: one transfer for the lot.
    expect(review.transfers).toEqual([
      { toWalletId: 'savings', amount: m(2300) },
    ])
  })

  it('leaves out a paused goal’s and a closed bill’s set-asides', () => {
    const { inputs, state, today } = world()
    const stopped = {
      ...inputs,
      goals: inputs.goals.map((g) =>
        g.id === 'umrah' ? { ...g, pausedAt: '2026-10-20' } : g,
      ),
      bills: inputs.bills.map((b) =>
        b.id === 'rent' ? { ...b, closedAt: '2026-10-20' } : b,
      ),
    }
    const review = paydayReview(stopped, state, '2026-10-25', {
      today,
      walletCurrency: CURRENCIES,
    })
    expect(review.groups.flatMap((g) => g.lines.map((l) => l.name))).toEqual([
      'Internet',
      'Car insurance',
      'Emergency fund',
    ])
  })

  it('lists the paydays waiting in the queue and counts their lines', () => {
    const { inputs, state, today } = world()
    const waiting = waitingReviews(inputs, state, {
      today,
      walletCurrency: CURRENCIES,
    })
    expect(waiting.map((r) => r.payday)).toEqual(['2026-10-25'])
    expect(reviewCount(waiting)).toBe(5)
  })

  it('re-totals transfers from the lines as edited, unticked ones left out', () => {
    expect(
      transfersFor(
        [
          { walletId: 'savings', amount: m(800), currency: 'SAR' },
          {
            walletId: 'savings',
            amount: m(1500),
            currency: 'SAR',
            ticked: false,
          },
          { walletId: 'usd', amount: m(100), currency: 'USD' },
          { walletId: 'main', amount: m(3000), currency: 'SAR' },
        ],
        'main',
        'SAR',
        RATES,
      ),
    ).toEqual([
      { toWalletId: 'savings', amount: m(800) },
      { toWalletId: 'usd', amount: m(375) },
    ])
  })
})

describe('Upcoming by payday', () => {
  const nodes = [
    wallet({ id: 'main', name: 'Main bank' }),
    wallet({ id: 'savings', name: 'Savings' }),
  ]

  it('groups rows into this pay period, the next paycheck and later ones', () => {
    const { inputs, state, today } = world({ today: '2026-10-02' })
    const view = buildUpcoming({ inputs, state, nodes, today })
    expect(
      view.periods.slice(0, 3).map((p) => [p.kind, p.period.start]),
    ).toEqual([
      ['this', '2026-09-25'],
      ['next', '2026-10-25'],
      ['later', '2026-11-25'],
    ])
    const next = view.periods[1]
    expect(next.incomeIn).toBe(m(12000))
    expect(next.payments.map((r) => r.name)).toEqual(['Rent', 'Internet'])
    expect(next.setAsideOut).toBe(m(5740))
    expect(next.left).toBe(m(12000 - 3200 - 5740))
  })

  it('says whether a bill payment is set aside', () => {
    const { inputs, state, today } = world({
      today: '2026-10-02',
      setAsides: [
        setAside({
          goalId: null,
          billId: 'rent',
          occurrence: '2026-11-01',
          amount: m(3000),
        }),
        setAside({
          goalId: null,
          billId: 'internet',
          occurrence: '2026-11-05',
          amount: m(50),
        }),
      ],
    })
    const view = buildUpcoming({ inputs, state, nodes, today })
    const coverage = Object.fromEntries(
      view.periods[1].payments.map((r) => [r.name, r.coverage?.state]),
    )
    expect(coverage).toEqual({ Rent: 'covered', Internet: 'partial' })
  })

  it('puts what came due first, under Needs confirming', () => {
    const { inputs, state, today } = world({
      today: '2026-11-02',
    })
    const view = buildUpcoming({ inputs, state, nodes, today })
    expect(view.due.map((r) => r.name)).toContain('Rent')
    expect(view.dueCount).toBe(view.due.length)
  })
})

describe('the year ahead', () => {
  it('lays out a year of months from this one, stretched to the latest goal date', () => {
    const { inputs, state, today } = world({ today: '2026-10-02' })
    const year = buildYearAhead(inputs, state, today)
    expect(year.months).toHaveLength(12)
    expect(year.months[0].month).toBe('2026-10')

    const later = buildYearAhead(
      {
        ...inputs,
        goals: [
          ...inputs.goals,
          goal({ id: 'far', target: m(100), dueDate: '2027-12-01' }),
        ],
      },
      state,
      today,
    )
    expect(later.months.at(-1)?.month).toBe('2027-12')
  })

  it('totals monthly bills per month and marks the ones saved up for', () => {
    const { inputs, state, today } = world({ today: '2026-10-02' })
    const year = buildYearAhead(inputs, state, today)
    const nov = year.months[1]
    expect(nov.income).toBe(m(12000))
    expect(nov.monthlyBills.total).toBe(m(3200))
    const mar = year.months.find((x) => x.month === '2027-03')
    expect(mar?.bigBills.map((b) => b.billId)).toEqual(['ins'])
    expect(year.ramps).toEqual([
      expect.objectContaining({
        billId: 'ins',
        occurrence: '2027-03-01',
        from: '2026-10-25',
        perPaycheck: m(240),
      }),
    ])
  })

  it('stacks each month’s set-asides by bill and goal', () => {
    const { inputs, state, today } = world({ today: '2026-10-02' })
    const oct = buildYearAhead(inputs, state, today).months[0]
    expect(oct.setAside.total).toBe(m(3200 + 240 + 800 + 1500))
    expect(oct.setAside.byOwner[0]).toMatchObject({
      ownerId: 'rent',
      color: RENT.color,
    })
  })

  it('draws each goal to its projected finish and flags one that slips past its date', () => {
    const car = goal({ id: 'car', target: m(60000), dueDate: '2027-01-01' })
    const { inputs, state, today } = world({
      today: '2026-10-02',
      goals: [EMERGENCY, car],
    })
    const bars = Object.fromEntries(
      buildYearAhead(inputs, state, today).goals.map((g) => [g.goalId, g]),
    )
    expect(bars.emergency).toMatchObject({
      from: '2026-10-25',
      finish: null,
      slips: false,
    })
    expect(bars.car).toMatchObject({
      target: '2027-01-01',
      slips: true,
    })
    expect(bars.car.slipsTo).not.toBeNull()
  })
})
