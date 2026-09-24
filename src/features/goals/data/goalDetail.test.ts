import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { buildGoalPlanView, collapseContributions } from '#/features/planned'
import { indexSettlements } from '#/features/planned/data/settle'
import {
  RATES,
  allocation,
  goal,
  m,
  planned,
  wallet,
} from '#/features/planned/testing/fixtures'
import type { GoalProgress } from './progress'
import { buildGoalDetail, dueCountByGoal, tidyMoney } from './goalDetail'
import type { RecalcSummary } from './goalDetail'

// The design's worked example (04 §4): Umrah SR 13,000 by Mar 1 2027, SR 1,000 saved up
// front, planned Jun 12 at SR 1,500 × 8 (Jul → Feb). Jul + Aug confirmed, Sep not. Today Sep 24.
const TODAY = '2026-09-24'
const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
const MONTHS = [
  '2026-07-01',
  '2026-08-01',
  '2026-09-01',
  '2026-10-01',
  '2026-11-01',
  '2026-12-01',
  '2027-01-01',
  '2027-02-01',
]

const umrah = (over: Partial<LocalGoal> = {}) =>
  goal({
    id: 'umrah',
    name: 'Umrah trip',
    color: '#F59E0B',
    target: m(13000),
    dueDate: '2027-03-01',
    saved: m(1000),
    plannedAt: '2026-06-12',
    planAmount: m(1500),
    planCount: 8,
    planStart: '2026-07-01',
    ...over,
  })

const row = (occurrence: string, over: Partial<LocalPlanned> = {}) =>
  planned({
    id: `umrah:${occurrence}`,
    goalId: 'umrah',
    name: 'Umrah trip set-aside',
    occurrence,
    status: occurrence < '2026-09-01' ? 'done' : 'open',
    ...over,
  })

const settled = [
  allocation({
    id: 'a-jul',
    goalId: 'umrah',
    plannedId: 'umrah:2026-07-01',
    amount: m(1500),
    date: '2026-07-01',
  }),
  allocation({
    id: 'a-aug',
    goalId: 'umrah',
    plannedId: 'umrah:2026-08-01',
    amount: m(1500),
    date: '2026-08-01',
  }),
]

const progressOf = (amount: number): GoalProgress => ({
  reserved: amount,
  spent: 0,
  progress: amount,
  stillReserved: amount,
  byWallet: { w1: amount },
  external: 0,
})

/** What today's engine would generate: the 9,000 left over Oct → Feb. */
const live = (amount: number) => MONTHS.slice(3).map((d) => row(d, { amount }))

function detailOf({
  g = umrah(),
  rows = MONTHS.map((d) => row(d)),
  desired = live(m(1800)),
  recalc = null,
}: {
  g?: LocalGoal
  rows?: LocalPlanned[]
  desired?: LocalPlanned[]
  recalc?: RecalcSummary | null
} = {}) {
  const view = buildGoalPlanView({
    goal: g,
    planned: rows,
    desired,
    txns: [],
    allocations: settled,
    progress: progressOf(m(3000)),
    nodes: [MAIN],
    index: indexSettlements([], settled),
    rates: RATES,
    today: TODAY,
  })
  return buildGoalDetail(
    g,
    view,
    recalc,
    collapseContributions(view.contributions),
  )
}

describe('buildGoalDetail — the worked example', () => {
  const detail = detailOf()

  it('heads with the goal, its target and date, and the percent saved', () => {
    expect(detail.subtitle).toBe('Goal · SR 13,000 by Mar 1, 2027')
    expect(detail.pctStr).toBe('31%')
  })

  it('draws settled solid and the unconfirmed Sep set-aside striped', () => {
    expect(detail.bar?.savedPct).toBeCloseTo((4000 / 13000) * 100)
    expect(detail.bar?.awaitingPct).toBeCloseTo((1500 / 13000) * 100)
    expect(detail.savedCaption).toBe(
      'SR 4,000 saved · SR 1,500 awaiting confirm',
    )
    expect(detail.leftCaption).toBe('SR 9,000 left')
  })

  it('puts the saved plan next to the plan from today', () => {
    expect(detail.plan?.left).toEqual({
      label: 'Saved plan · Jun 12',
      amountStr: 'SR 1,500',
      unit: '/mo',
      sub: '× 8 set-asides',
    })
    expect(detail.plan?.right).toMatchObject({
      label: 'From today',
      amountStr: 'SR 1,800',
      sub: '× 5 set-asides',
    })
    expect(detail.plan?.highlightRight).toBe(false)
  })

  it('explains being behind and offers both ways out', () => {
    expect(detail.band).toEqual({
      kind: 'behind',
      title: 'SR 1,500 behind plan',
      text: "The Sep 1 set-aside hasn't been confirmed. Confirm it to stay on SR 1,500/mo, or spread the gap over the months left.",
      recalcLabel: 'Recalculate to SR 1,800',
      confirmLabel: 'Confirm Sep',
      confirmId: 'umrah:2026-09-01',
    })
  })

  it('lists confirmed, due and planned rows, collapsing the equal run', () => {
    expect(
      detail.contributions.map((c) => [
        c.mark,
        c.dateStr,
        c.caption,
        c.amountStr,
      ]),
    ).toEqual([
      ['confirmed', 'Jul 1', 'Main Checking · confirmed', 'SR 1,500'],
      ['confirmed', 'Aug 1', 'Main Checking · confirmed', 'SR 1,500'],
      ['due', 'Sep 1', 'Planned · needs confirming', 'SR 1,500'],
      ['future', 'Oct 1', 'Planned', 'SR 1,500'],
      ['future', 'Nov 1 – Feb 1', 'Planned · 4 more', 'SR 1,500 each'],
    ])
    expect(detail.contributions[2].plannedId).toBe('umrah:2026-09-01')
    expect(detail.contributions[0].allocationId).toBe('a-jul')
    expect(detail.contributions[4].plannedId).toBeNull()
    expect(detail.earlierCount).toBe(0)
  })

  it("sums up 1b's sub line", () => {
    expect(detail.addSub).toBe('SR 9,000 left · next planned Oct 1')
  })
})

describe('buildGoalDetail — after a recalc', () => {
  const recalc: RecalcSummary = {
    at: TODAY,
    before: { plannedAt: '2026-06-12', planAmount: m(1500), planCount: 8 },
    header: {
      amount: m(1800),
      count: 5,
      start: '2026-10-01',
      end: '2027-02-01',
    },
  }
  const detail = detailOf({
    g: umrah({ plannedAt: TODAY, planAmount: m(1800), planCount: 5 }),
    rows: MONTHS.map((d) =>
      row(d, d >= '2026-10-01' ? { amount: m(1800) } : {}),
    ),
    recalc,
  })

  it('shows the previous plan and highlights the new one', () => {
    expect(detail.plan?.left?.label).toBe('Previous plan')
    expect(detail.plan?.left?.amountStr).toBe('SR 1,500')
    expect(detail.plan?.highlightRight).toBe(true)
  })

  it('says what changed, with an undo band', () => {
    expect(detail.band).toEqual({
      kind: 'updated',
      lead: 'Plan updated Sep 24.',
      text: 'Oct–Feb planned set-asides now SR 1,800 each.',
    })
  })
})

describe('buildGoalDetail — other states', () => {
  it('says ahead when more was confirmed than planned', () => {
    const extra = allocation({
      goalId: 'umrah',
      plannedId: 'umrah:2026-09-01',
      amount: m(2000),
    })
    const g = umrah()
    const view = buildGoalPlanView({
      goal: g,
      planned: MONTHS.map((d) =>
        row(d, d === '2026-09-01' ? { status: 'done' } : {}),
      ),
      desired: live(m(1400)),
      txns: [],
      allocations: [...settled, extra],
      progress: progressOf(m(5000)),
      nodes: [MAIN],
      index: indexSettlements([], [...settled, extra]),
      rates: RATES,
      today: TODAY,
    })
    const detail = buildGoalDetail(g, view, null, [])
    expect(detail.band).toEqual({
      kind: 'ahead',
      title: 'SR 500 ahead of plan',
      recalcLabel: 'Recalculate to SR 1,400',
    })
  })

  it('names a skipped month', () => {
    const detail = detailOf({
      rows: MONTHS.map((d) =>
        row(d, d === '2026-09-01' ? { status: 'skipped' } : {}),
      ),
    })
    expect(detail.band).toMatchObject({
      kind: 'behind',
      text: "You skipped Sep's SR 1,500. Spread the gap over the months left, or add a contribution.",
      confirmId: null,
    })
  })

  it('shows a quiet off-plan line when nothing is behind', () => {
    const onPlan = detailOf({
      rows: MONTHS.filter((d) => d >= '2026-10-01').map((d) => row(d)),
      desired: live(m(1700)),
    })
    expect(onPlan.band).toEqual({
      kind: 'off',
      text: "Plan is SR 200/mo off from today's numbers",
    })
  })

  it('shows a bill by its cycle, with its payment as the plan', () => {
    const rent = goal({
      id: 'rent',
      name: 'Rent',
      kind: 'recurring',
      amount: m(3500),
      frequency: 'monthly',
      nextDue: '2026-10-01',
      plannedAt: '2026-06-12',
      planAmount: m(3500),
      planCount: 0,
    })
    const payment = planned({
      id: 'rent:2026-10-01',
      goalId: 'rent',
      role: 'payment',
      name: 'Rent',
      amount: m(3500),
      occurrence: '2026-10-01',
    })
    const view = buildGoalPlanView({
      goal: rent,
      planned: [payment],
      desired: [payment],
      txns: [],
      allocations: [],
      progress: undefined,
      nodes: [MAIN],
      index: indexSettlements([], []),
      rates: RATES,
      today: TODAY,
    })
    const detail = buildGoalDetail(rent, view, null, [])
    expect(detail.subtitle).toBe('Obligation · SR 3,500 due Oct 1')
    expect(detail.savedCaption).toBe('SR 0 paid this cycle')
    expect(detail.plan?.right).toMatchObject({
      amountStr: 'SR 3,500',
      unit: '/mo',
      sub: 'paid when due',
    })
    expect(detail.band).toBeNull()
  })

  it('folds older confirmed rows behind "Show earlier"', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      allocation({
        goalId: 'umrah',
        amount: m(100),
        date: `2026-0${i + 1}-15`,
      }),
    )
    const g = umrah({ plannedAt: null })
    const view = buildGoalPlanView({
      goal: g,
      planned: [],
      desired: [],
      txns: [],
      allocations: many,
      progress: progressOf(m(800)),
      nodes: [MAIN],
      index: indexSettlements([], many),
      rates: RATES,
      today: TODAY,
    })
    const detail = buildGoalDetail(
      g,
      view,
      null,
      collapseContributions(view.contributions),
    )
    expect(detail.contributions).toHaveLength(8)
    expect(detail.earlierCount).toBe(3)
    expect(detail.plan).toBeNull()
  })
})

describe('dueCountByGoal', () => {
  it('counts open items dated today or earlier, per goal', () => {
    expect(
      dueCountByGoal(
        [
          row('2026-09-01'),
          row('2026-09-24', { id: 'today' }),
          row('2026-10-01'),
          row('2026-08-01', { id: 'done', status: 'done' }),
          row('2026-08-15', { id: 'gone', deleted: 1 }),
          planned({ id: 'pay', goalId: null, occurrence: '2026-09-01' }),
        ],
        TODAY,
      ),
    ).toEqual({ umrah: 2 })
  })
})

describe('tidyMoney', () => {
  it('drops minor units only when there are none', () => {
    expect(tidyMoney(m(1500), 'SAR')).toBe('SR 1,500')
    expect(tidyMoney(150050, 'SAR')).toBe('SR 1,500.50')
  })
})
