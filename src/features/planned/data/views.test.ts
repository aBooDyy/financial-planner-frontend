import { describe, expect, it } from 'vitest'
import {
  RATES,
  allocation,
  goal,
  m,
  planned,
  wallet,
} from '#/features/planned/testing/fixtures'
import { indexSettlements } from './settle'
import {
  buildGoalPlanView,
  buildPlannedList,
  collapseContributions,
  relativeDue,
} from './views'
import type { ContributionEntry } from './views'

const TODAY = '2026-09-24'
const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
const UMRAH = goal({ id: 'umrah', name: 'Umrah trip', target: m(13000) })
const RENT = goal({ id: 'rent', name: 'Rent', kind: 'recurring' })

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
      goalId: 'rent',
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
    goals: [UMRAH, RENT],
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
      tag: 'obligation',
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
      goals: [UMRAH],
      nodes: [MAIN],
      index: indexSettlements(
        [],
        [allocation({ plannedId: 'umrah:2026-09-01', amount: m(1000) })],
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
    const allocations = [
      allocation({
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
      allocations,
      progress: undefined,
      nodes: [MAIN],
      index: indexSettlements([], allocations),
      rates: RATES,
      today: TODAY,
    })
    expect(view.contributions.map((c) => [c.date, c.state, c.caption])).toEqual(
      [
        ['2026-08-02', 'confirmed', 'Main Checking · confirmed'],
        ['2026-09-01', 'due', 'Planned · needs confirming'],
        ['2026-10-01', 'future', 'Planned'],
      ],
    )
    expect(view.nextPlanned?.id).toBe('umrah:2026-10-01')
    expect(view.stored).toMatchObject({ amount: m(1500), count: 8 })
  })
})
