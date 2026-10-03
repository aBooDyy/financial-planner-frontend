import { describe, expect, it } from 'vitest'
import {
  RATES,
  bill,
  goal,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { billOwner } from './owners'
import { indexSettlements } from './settle'
import {
  buildGoalPlanView,
  buildPlannedList,
  collapseContributions,
  comparePlan,
  relativeDue,
} from './views'
import type { ContributionEntry } from './views'

const TODAY = '2026-09-24'
const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
const UMRAH = goal({ id: 'umrah', name: 'Umrah trip', target: m(13000) })

const umrahMonth = (occurrence: string, over = {}) =>
  planned({
    id: `umrah:${occurrence}`,
    goalId: 'umrah',
    name: 'Umrah trip set-aside',
    occurrence,
    ...over,
  })

describe('relativeDue', () => {
  it('is relative within two weeks and absolute beyond', () => {
    expect(relativeDue('2026-09-24', TODAY)).toBe('Due today')
    expect(relativeDue('2026-09-27', TODAY)).toBe('in 3 days')
    expect(relativeDue('2026-09-01', TODAY)).toBe('23 days late')
    expect(relativeDue('2026-10-15', TODAY)).toBe('Oct 15')
  })
})

describe('buildPlannedList', () => {
  const items = [
    ...[
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ].map((d) =>
      umrahMonth(d, {
        status: d < '2026-09-01' ? ('done' as const) : ('open' as const),
      }),
    ),
    planned({
      id: 'rent-sep',
      origin: 'bill',
      goalId: null,
      billId: 'rent',
      role: 'payment',
      name: 'Rent',
      walletId: 'w1',
      amount: m(3500),
      occurrence: '2026-09-24',
    }),
    planned({
      id: 'salary',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 's1',
      name: 'Salary',
      walletId: 'w1',
      amount: m(12000),
      occurrence: '2026-09-27',
    }),
  ]
  const view = buildPlannedList({
    planned: items,
    nodes: [MAIN],
    index: indexSettlements([], []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })

  it('splits needs-confirming, the next 14 days and later, oldest first', () => {
    expect(view.due.map((r) => r.id)).toEqual(['umrah:2026-09-01', 'rent-sep'])
    expect(view.dueCount).toBe(2)
    expect(view.next.map((r) => r.id)).toEqual(['salary', 'umrah:2026-10-01'])
    expect(view.later.map((r) => r.id)).toEqual([
      'umrah:2026-11-01',
      'umrah:2026-12-01',
      'umrah:2027-01-01',
      'umrah:2027-02-01',
    ])
    expect(view.laterLabel).toBe('Later in November')
  })

  it('reads a row the way the design does', () => {
    const [sep, rent] = view.due
    expect(sep).toMatchObject({
      tag: 'goal',
      tagLabel: 'Goal',
      direction: 'out',
      metaStr: 'Set-aside 3 of 8 · due Sep 1 · 23 days late',
      oneTap: false,
      amountStr: 'SR 1,500.00',
    })
    expect(rent).toMatchObject({
      tag: 'bill',
      metaStr: 'Due today · Main Checking',
      oneTap: true,
    })
    expect(view.next[0]).toMatchObject({ tag: 'income', direction: 'in' })
  })

  it('sums the next 14 days as income in and outflow out, set-asides as outflow', () => {
    expect(view.nextIn).toBe(m(12000))
    expect(view.nextOut).toBe(m(1500))
    expect(view.nextCaption).toBe('+SR 12,000.00 · −SR 1,500.00')
  })

  it('shows a partly settled row by its remainder', () => {
    const partial = buildPlannedList({
      planned: [umrahMonth('2026-09-01')],
      nodes: [MAIN],
      index: indexSettlements(
        [],
        [setAside({ plannedId: 'umrah:2026-09-01', amount: m(1000) })],
      ),
      rates: RATES,
      base: 'SAR',
      today: TODAY,
    })
    expect(partial.due[0]).toMatchObject({
      remainder: m(500),
      isPartial: true,
      ofStr: 'of SR 1,500.00',
    })
  })
})

describe('collapseContributions', () => {
  const entry = (
    date: string,
    state: ContributionEntry['state'],
    amount = m(1500),
  ): ContributionEntry => ({
    key: date,
    state,
    date,
    amount,
    source: 'planned',
    settlementId: null,
    plannedId: date,
    walletId: null,
    externalLabel: null,
    caption: '',
  })

  it('folds a run of equal future rows behind its first', () => {
    const out = collapseContributions([
      entry('2026-09-01', 'due'),
      entry('2026-10-01', 'future'),
      entry('2026-11-01', 'future'),
      entry('2026-12-01', 'future'),
      entry('2027-01-01', 'future'),
      entry('2027-02-01', 'future'),
    ])
    expect(out).toHaveLength(3)
    expect(out[2]).toMatchObject({
      from: '2026-11-01',
      to: '2027-02-01',
      count: 4,
      amount: m(1500),
    })
  })

  it('leaves short runs and differing amounts as they are', () => {
    const out = collapseContributions([
      entry('2026-10-01', 'future'),
      entry('2026-11-01', 'future'),
      entry('2026-12-01', 'future', m(1800)),
    ])
    expect(out).toHaveLength(3)
  })
})

describe('buildGoalPlanView', () => {
  it('lists settlements and planned rows in date order with their state', () => {
    const rows = [
      umrahMonth('2026-08-01', { status: 'done' }),
      umrahMonth('2026-09-01'),
      umrahMonth('2026-10-01'),
    ]
    const setAsides = [
      setAside({
        id: 'a-aug',
        goalId: 'umrah',
        plannedId: 'umrah:2026-08-01',
        amount: m(1500),
        date: '2026-08-02',
      }),
    ]
    const view = buildGoalPlanView({
      goal: {
        ...UMRAH,
        plannedAt: '2026-06-12',
        planAmount: m(1500),
        planCount: 8,
      },
      planned: rows,
      desired: [],
      txns: [],
      setAsides,
      progress: undefined,
      nodes: [MAIN],
      index: indexSettlements([], setAsides),
      rates: RATES,
      today: TODAY,
    })
    expect(view.contributions.map((c) => [c.date, c.state, c.caption])).toEqual(
      [
        ['2026-08-02', 'confirmed', 'Main Checking · confirmed'],
        ['2026-09-01', 'due', 'Upcoming · needs confirming'],
        ['2026-10-01', 'future', 'Upcoming'],
      ],
    )
    expect(view.nextPlanned?.id).toBe('umrah:2026-10-01')
    expect(view.stored).toMatchObject({ amount: m(1500), count: 8 })
  })
})

describe('comparePlan — a bill whose rows drifted under the same headline', () => {
  const TODAY_OCT = '2026-10-03'
  /** Monthly SR 3,500 due on the 1st; set-asides fall on the 25th paydays. */
  const RENT = bill({
    id: 'rent',
    name: 'Rent',
    amount: m(3500),
    nextDue: '2026-12-01',
    plannedAt: '2026-09-01',
    planAmount: m(3500),
    planCount: 1,
    planStart: '2026-11-25',
  })
  const rentSetAside = (occurrence: string, amount: number) =>
    planned({
      id: `rent:${occurrence}`,
      origin: 'bill',
      goalId: null,
      billId: 'rent',
      name: 'Rent',
      occurrence,
      amount: m(amount),
    })
  const compare = (rows: ReturnType<typeof rentSetAside>[]) =>
    comparePlan({
      owner: billOwner('rent'),
      snapshot: RENT,
      desired: [rentSetAside('2026-11-25', 3500)],
      planned: rows,
      index: indexSettlements([], []),
      rates: RATES,
      today: TODAY_OCT,
    })

  it('is off plan when an older engine split it 1,750 × 2 and today wants 3,500 once', () => {
    const plan = compare([
      rentSetAside('2026-10-25', 1750),
      rentSetAside('2026-11-25', 1750),
    ])
    expect(plan.live.amount).toBe(plan.stored?.amount)
    expect(plan.rows).toEqual({
      stored: { total: m(3500), count: 2, each: m(1750), start: '2026-10-25' },
      live: { total: m(3500), count: 1, each: m(3500), start: '2026-11-25' },
      differ: true,
    })
    expect(plan.isOffPlan).toBe(true)
  })

  it('is on plan once its rows are what a recalc would write', () => {
    expect(compare([rentSetAside('2026-11-25', 3500)]).isOffPlan).toBe(false)
  })

  it('leaves to the background fill the rows past its last set-aside', () => {
    expect(compare([]).isOffPlan).toBe(false)
    expect(
      compare([{ ...rentSetAside('2026-09-25', 3500), status: 'done' }])
        .isOffPlan,
    ).toBe(false)
  })

  it('leaves rows a recalc may not rewrite out of it', () => {
    const plan = compare([
      { ...rentSetAside('2026-10-25', 1750), pinned: true },
      rentSetAside('2026-11-25', 1750),
    ])
    expect(plan.rows.stored).toMatchObject({ count: 1, total: m(1750) })
    expect(plan.rows.live).toMatchObject({ count: 1, total: m(1750) })
    expect(plan.rows.differ).toBe(false)
  })
})
