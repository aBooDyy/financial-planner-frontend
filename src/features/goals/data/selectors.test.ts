import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import { buildGoalsView } from './selectors'

// Reference point the design plans from (Jun 12, 2026) and its FX table.
const TODAY = new Date(2026, 5, 12)
const RATES: Partial<Record<string, number>> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.05,
  GBP: 4.75,
  AED: 1.02,
}

// SAR/USD have 2 minor digits, so whole-currency amounts scale by 100.
const m = (whole: number) => whole * 100

let seq = 0
const income = (over: Partial<LocalIncomeStream>): LocalIncomeStream => ({
  id: `i${seq++}`,
  label: 'Income',
  amount: 0,
  currency: 'SAR',
  frequency: 'monthly',
  day: 1,
  color: '#1F9D6B',
  position: seq,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const goal = (over: Partial<LocalGoal>): LocalGoal => ({
  id: `g${seq++}`,
  name: 'Goal',
  kind: 'onetime',
  currency: 'SAR',
  color: '#EC4899',
  position: seq,
  amount: null,
  target: null,
  saved: 0,
  frequency: null,
  nextDue: null,
  dueDate: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const base: CurrencyCode = 'SAR'

describe('buildGoalsView funding engine', () => {
  it('normalizes multi-currency income to a monthly base figure', () => {
    const view = buildGoalsView(
      [
        income({ label: 'Salary', amount: m(12000), currency: 'SAR', day: 27 }),
        income({ label: 'Side', amount: m(800), currency: 'USD', day: 5 }),
      ],
      [],
      base,
      RATES,
      TODAY,
    )
    // 12,000 SAR + (800 USD * 3.75) = 15,000 SAR/mo.
    expect(view.incomeMonthly).toBe(m(15000))
    expect(view.incomeStr).toBe('SR 15,000')
  })

  it('never sets aside more than income on an over-subscribed plan, and funds the nearest first', () => {
    const incomes = [
      income({ label: 'Salary', amount: m(12000), day: 27 }),
      income({ label: 'Side', amount: m(800), currency: 'USD', day: 5 }),
    ]
    const goals = [
      goal({
        name: 'Rent',
        kind: 'recurring',
        amount: m(3500),
        frequency: 'monthly',
        nextDue: '2026-07-01',
        position: 0,
      }),
      goal({
        name: 'Tuition',
        kind: 'recurring',
        amount: m(8400),
        frequency: 'semi',
        nextDue: '2027-01-10',
        saved: m(2000),
        position: 1,
      }),
      goal({
        name: 'Car insurance',
        kind: 'recurring',
        amount: m(5400),
        frequency: 'annual',
        nextDue: '2026-11-20',
        position: 2,
      }),
      goal({
        name: 'Emergency fund',
        kind: 'openended',
        amount: m(1500),
        target: m(30000),
        saved: m(8000),
        position: 3,
      }),
      goal({
        name: 'New car',
        kind: 'onetime',
        target: m(55000),
        saved: m(6000),
        dueDate: '2027-12-01',
        position: 4,
      }),
      goal({
        name: 'Home down-payment',
        kind: 'onetime',
        target: m(48000),
        saved: m(4000),
        dueDate: '2027-06-15',
        position: 5,
      }),
      goal({
        name: 'Umrah',
        kind: 'onetime',
        target: m(13000),
        saved: m(1000),
        dueDate: '2027-03-01',
        position: 6,
      }),
      goal({
        name: 'Eid',
        kind: 'sinking',
        amount: m(7200),
        frequency: 'annual',
        nextDue: '2027-05-01',
        position: 7,
      }),
      goal({
        name: 'New laptop',
        kind: 'onetime',
        target: m(9000),
        dueDate: '2026-12-10',
        position: 8,
      }),
    ]
    const view = buildGoalsView(incomes, goals, base, RATES, TODAY)

    // Time-phased planning never schedules more than this month's income, so the plan always
    // balances — risk shows up as goals that slip, not as a negative "left over".
    expect(view.totalRequired).toBeLessThanOrEqual(view.incomeMonthly + 1)
    expect(view.leftover).toBeGreaterThanOrEqual(0)
    // Demand exceeds the SR 15,000/mo income, so every spare riyal is allocated.
    expect(view.setAsideStr).toBe(view.incomeStr)
    expect(view.goalCards).toHaveLength(9)
    expect(view.fundedCount + view.atRiskCount).toBe(9)

    // Rent is due next month — earliest deadline, so it's funded first and fully.
    const rent = view.goalCards.find((c) => c.name === 'Rent')
    expect(rent?.status).toBe('green')
    // Every card carries a month-by-month plan — even an ongoing recurring obligation, whose
    // timeline runs to its upcoming due and notes that it repeats.
    expect(rent?.hasSchedule).toBe(true)
    expect(rent?.coverageStr).toContain('repeats')
    // …but a monthly obligation is kept off the payments timeline (it would appear every month).
    expect(view.timeline.some((t) => t.name === 'Rent')).toBe(false)
  })

  it('defers a later obligation behind a nearer one — by date, not rank — then ramps it up', () => {
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(700), day: 1 })],
      [
        // Ranked first by the user, but due later — so it must wait.
        goal({
          name: 'Service',
          kind: 'onetime',
          target: m(1200),
          dueDate: '2026-12-15',
          position: 0,
        }),
        // Ranked second, but due in 2 months — date wins, it's funded now.
        goal({
          name: 'Insurance',
          kind: 'onetime',
          target: m(1400),
          dueDate: '2026-08-15',
          position: 1,
        }),
      ],
      base,
      RATES,
      TODAY,
    )

    const insurance = view.goalCards.find((c) => c.name === 'Insurance')
    const service = view.goalCards.find((c) => c.name === 'Service')

    // The nearer deadline takes this month's whole income, despite ranking lower.
    expect(insurance?.status).toBe('green')
    expect(insurance?.monthlyStr).toBe('SR 700')

    // The later goal sets aside nothing this month but is still on track. Its headline shows
    // the real rate it ramps to (not a bare SR 0), qualified by when funding starts.
    expect(service?.status).toBe('amber')
    expect(service?.isDeferred).toBe(true)
    expect(service?.isOver).toBe(false)
    expect(service?.monthlyStr).toBe('SR 300')
    expect(service?.monthlySubStr).toContain('Aug')
    // The full month-by-month plan is available immediately, not only once nearer goals clear.
    expect(service?.hasSchedule).toBe(true)
    expect(service?.scheduleSummary).toContain('SR 300')
    expect(service?.coverageStr).toContain('Covered')
    // A row per month from now until it's covered: SR 0 while it waits, then SR 300/mo.
    expect(service?.scheduleMonths).toHaveLength(6)
    expect(service?.scheduleMonths[0]).toMatchObject({
      amountStr: 'SR 0',
      muted: true,
      covered: false,
    })
    const lastMonth = service?.scheduleMonths.at(-1)
    expect(lastMonth?.amountStr).toBe('SR 300')
    expect(lastMonth?.covered).toBe(true)
  })

  it('sequences overlapping deadlines that flat budgeting would call over budget', () => {
    // Flat amortization: A wants 600/mo + B wants 300/mo = 900/mo on 600/mo income → "over
    // budget". Phasing pays A first (months 1–2), then B (months 3–4): both meet their dates.
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(600), day: 1 })],
      [
        goal({
          name: 'A',
          kind: 'onetime',
          target: m(1200),
          dueDate: '2026-08-15',
          position: 0,
        }),
        goal({
          name: 'B',
          kind: 'onetime',
          target: m(1200),
          dueDate: '2026-10-15',
          position: 1,
        }),
      ],
      base,
      RATES,
      TODAY,
    )

    // No goal slips: both are met on time once sequenced.
    expect(view.goalCards.every((c) => !c.isOver)).toBe(true)
    expect(view.verdict.status).not.toBe('red')
    // This month spends the full income on the nearer goal; nothing is "over".
    expect(view.setAsideStr).toBe('SR 600')
    expect(view.goalCards.find((c) => c.name === 'A')?.status).toBe('green')
    // B is queued, so its headline shows the SR 600/mo rate it ramps to, not SR 0.
    const bCard = view.goalCards.find((c) => c.name === 'B')
    expect(bCard?.monthlyStr).toBe('SR 600')
    expect(bCard?.hasSchedule).toBe(true)
  })

  it('runs a recurring obligation forever — its plan and timeline span up to the last goal', () => {
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(10000), day: 1 })],
      [
        // Annual obligation, first due in 12 months (SR 100/mo). It recurs, so it must stay in
        // the plan past its first due — covered again a year later.
        goal({
          name: 'Insurance',
          kind: 'recurring',
          amount: m(1200),
          frequency: 'annual',
          nextDue: '2027-06-15',
          position: 0,
        }),
        // The latest goal — due in 24 months — sets how far the plan must reach.
        goal({
          name: 'Laptop',
          kind: 'onetime',
          target: m(2400),
          dueDate: '2028-06-15',
          position: 1,
        }),
      ],
      base,
      RATES,
      TODAY,
    )

    const insurance = view.goalCards.find((c) => c.name === 'Insurance')
    // The obligation's plan extends well past its own first 12-month cycle, out toward the goal.
    expect(insurance?.scheduleMonths.length).toBeGreaterThan(12)
    // Covered twice within the horizon: this year's due and next year's.
    expect(insurance?.scheduleMonths.filter((mo) => mo.covered).length).toBe(2)

    // The payments timeline lists each obligation cycle in order, plus the goal's completion.
    expect(view.timeline.filter((t) => t.name === 'Insurance').length).toBe(2)
    expect(view.timeline.filter((t) => t.name === 'Laptop').length).toBe(1)
  })

  it('is on track when income comfortably covers the goals', () => {
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(20000), day: 1 })],
      [
        goal({
          name: 'Phone',
          kind: 'onetime',
          target: m(6000),
          dueDate: '2027-06-01',
          position: 0,
        }),
      ],
      base,
      RATES,
      TODAY,
    )
    expect(view.leftover).toBeGreaterThan(0)
    expect(view.verdict.status).toBe('green')
    expect(view.fundedCount).toBe(1)
    expect(view.atRiskCount).toBe(0)
    // An on-track one-time goal with a deadline shows up on the completion timeline.
    expect(view.timeline.some((t) => t.name === 'Phone')).toBe(true)
    // The green status reads "On track", not "Funded".
    expect(view.goalCards[0]?.statusLabel).toBe('On track')
  })

  it('moves goals whose target is fully saved into a separate completed list', () => {
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(20000), day: 1 })],
      [
        goal({
          name: 'Phone',
          kind: 'onetime',
          target: m(6000),
          saved: m(6000),
          dueDate: '2027-06-01',
          position: 0,
        }),
        goal({
          name: 'Watch',
          kind: 'onetime',
          target: m(3000),
          saved: m(9000),
          dueDate: '2027-06-01',
          position: 1,
        }),
        goal({
          name: 'Car',
          kind: 'onetime',
          target: m(50000),
          saved: m(1000),
          dueDate: '2027-06-01',
          position: 2,
        }),
        goal({
          name: 'Rent',
          kind: 'recurring',
          amount: m(3500),
          frequency: 'monthly',
          nextDue: '2026-07-01',
          position: 3,
        }),
      ],
      base,
      RATES,
      TODAY,
    )

    // Met-target goals leave the active plan; an overshoot (saved > target) counts too.
    expect(view.completedGoals.map((c) => c.name).sort()).toEqual([
      'Phone',
      'Watch',
    ])
    // Recurring obligations never "complete" — they keep recurring in the active plan.
    expect(view.goalCards.map((c) => c.name).sort()).toEqual(['Car', 'Rent'])
    expect(view.totalCount).toBe(2)
    // Completed goals draw no income from the plan.
    expect(view.setAsideStr).not.toContain('NaN')
  })

  it('folds sourced allocations into a goal’s saved progress', () => {
    const incomes = [income({ label: 'Salary', amount: m(20000), day: 1 })]
    const car = goal({
      id: 'car',
      name: 'Car',
      kind: 'onetime',
      target: m(10000),
      saved: m(2000),
      dueDate: '2027-06-01',
      position: 0,
    })
    // Stored saved 2,000 + an allocation of 8,000 = 10,000 → the goal is fully funded.
    const view = buildGoalsView(incomes, [car], base, RATES, TODAY, {}, 'dmy', {
      car: m(8000),
    })
    expect(view.completedGoals.map((c) => c.id)).toEqual(['car'])
    expect(view.goalCards.some((c) => c.id === 'car')).toBe(false)
  })
})
