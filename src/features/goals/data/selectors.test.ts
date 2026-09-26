import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import { buildGoalsView, planGoals } from './selectors'

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
  walletId: null,
  anchorDate: null,
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
  customInterval: null,
  customUnit: null,
  nextDue: null,
  dueDate: null,
  plannedAt: null,
  planAmount: null,
  planCount: null,
  planStart: null,
  setAsideDay: null,
  payOnDue: false,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const base: CurrencyCode = 'SAR'

describe('buildGoalsView funding engine', () => {
  it('dates a stream’s next payday from its anchor', () => {
    const view = buildGoalsView(
      [
        income({ label: 'Salary', amount: m(12000), day: 31 }),
        income({
          label: 'Bonus',
          amount: m(3000),
          frequency: 'quarterly',
          day: 20,
          anchorDate: '2026-08-20',
        }),
      ],
      [],
      base,
      RATES,
      TODAY,
    )
    expect(view.incomeRows.map((r) => r.payStr)).toEqual([
      'Paid the 31st · next 30/06/2026',
      'Next payday 20/08/2026',
    ])
  })

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

  it('invites a fresh account to start its plan instead of calling it tight', () => {
    const view = buildGoalsView([], [], base, RATES, TODAY)
    expect(view.verdict.title).toBe('Start your plan')
    expect(view.verdict.sub).not.toMatch(/to spare/)
  })

  it('points to the free income when there are no goals yet', () => {
    const view = buildGoalsView(
      [income({ label: 'Salary', amount: m(5000), day: 1 })],
      [],
      base,
      RATES,
      TODAY,
    )
    expect(view.verdict.title).toBe('Start your plan')
    expect(view.verdict.sub).toContain('SR 5,000/mo free')
  })

  it('asks for income when goals exist but none is set up', () => {
    const view = buildGoalsView(
      [],
      [goal({ name: 'Fund', kind: 'openended', amount: m(100), position: 0 })],
      base,
      RATES,
      TODAY,
    )
    expect(view.verdict.title).not.toBe('Tight but on track')
    expect(view.verdict.sub).not.toMatch(/to spare/)
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

  // The trailing `allocations` argument is gone: allocations and goal-linked spends now reach
  // the view as one settled-progress figure (`goals/data/progress.ts`, max of the two rather
  // than their sum), passed where `contributions` used to be.
  it('folds settled progress into a goal’s saved progress', () => {
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
    const view = buildGoalsView(incomes, [car], base, RATES, TODAY, {
      car: m(8000),
    })
    expect(view.completedGoals.map((c) => c.id)).toEqual(['car'])
    expect(view.goalCards.some((c) => c.id === 'car')).toBe(false)
  })
})

describe('buildGoalsView sections', () => {
  // Rent is fundable; a 100,000 laptop due in ~7 weeks on 1,000/mo of income is not.
  const plan = () =>
    buildGoalsView(
      [income({ label: 'Salary', amount: m(1000), day: 27 })],
      [
        goal({
          id: 'rent',
          name: 'Rent',
          kind: 'recurring',
          amount: m(500),
          frequency: 'monthly',
          nextDue: '2026-07-01',
          position: 0,
        }),
        goal({
          id: 'laptop',
          name: 'Laptop',
          kind: 'onetime',
          target: m(100000),
          dueDate: '2026-08-01',
          position: 1,
        }),
      ],
      base,
      RATES,
      TODAY,
    )

  it('splits goals from obligations and groups each tab by funding status', () => {
    const view = plan()
    expect(view.obligationsList.count).toBe(1)
    expect(view.obligationsList.groups.map((g) => g.title)).toEqual([
      'On track · 1',
    ])
    expect(view.goalsList.groups.map((g) => g.title)).toEqual([
      'Won’t make it · 1',
    ])
    expect(view.goalsList.groups[0].note).toMatch(/^about SR [\d,]+\/mo short$/)
    expect(view.goalCards.find((c) => c.id === 'rent')?.rowMeta).toBe(
      'Obligation · every month · Jul 1',
    )
  })

  it('summarizes income usage and surfaces only slipping goals as decisions', () => {
    const view = plan()
    expect(view.summary.usagePct).toBe(100)
    expect(view.summary.decisions).toHaveLength(1)
    expect(view.summary.decisions[0]).toMatchObject({
      goalId: 'laptop',
      action: 'Push out',
    })
    expect(view.cashflowStr).toBe('SR 1,000 in · SR 1,000 out')
  })

  it('measures every ledger bar against one denominator', () => {
    const { ledger, ledgerNet, usageStr } = plan().summary
    expect(ledger.map((row) => [row.label, row.valueStr])).toEqual([
      ['Income', 'SR 1,000'],
      ['Obligations', 'SR 500'],
      ['Goals', 'SR 500'],
    ])
    expect(ledger[0].pct).toBe(100)
    expect(ledgerNet).toMatchObject({ label: 'Left over', pct: 0 })
    expect(usageStr).toBe('100% of income committed')
  })

  it('ranks the priority list by position and notes what is not on track', () => {
    const { priority, priorityNote } = plan().summary
    expect(priority.map((row) => [row.num, row.id, row.status])).toEqual([
      ['1', 'rent', 'green'],
      ['2', 'laptop', 'red'],
    ])
    expect(priority[0].note).toBe('')
    expect(priority[1].note).toBe('Won’t make it')
    expect(priorityNote).toBe('1 of 2 on track')
  })

  it('lists paydays and due dates in the next 60 days, repeating ones included', () => {
    const { upcoming } = plan().summary
    expect(upcoming.map((e) => `${e.dateStr} ${e.name}`)).toEqual([
      'Jun 27 Salary in',
      'Jul 1 Rent',
      'Jul 27 Salary in',
      'Aug 1 Rent',
      'Aug 1 Laptop',
    ])
    expect(upcoming[0]).toMatchObject({
      amountStr: '+SR 1,000',
      incoming: true,
    })
  })
})

describe('planGoals — custom frequencies', () => {
  const refill = (over: Partial<LocalGoal>) =>
    goal({
      kind: 'recurring',
      amount: m(280),
      frequency: 'custom',
      customInterval: 28,
      customUnit: 'day',
      nextDue: '2026-06-20',
      ...over,
    })
  const plan = (g: LocalGoal) =>
    planGoals([income({ amount: m(10000) })], [g], base, RATES, TODAY)
      .entries[0].track

  it('refills a bill due more than once a month by its monthly worth', () => {
    const track = plan(refill({}))
    expect(track.cycleMonths).toBe(1)
    expect(track.cycleAmount).toBeCloseTo((m(280) * 365) / 28 / 12)
  })

  it('treats a custom every-2-months bill as a two-month cycle', () => {
    const track = plan(refill({ customInterval: 2, customUnit: 'month' }))
    expect(track.cycleMonths).toBe(2)
    expect(track.cycleAmount).toBe(m(280))
  })
})
