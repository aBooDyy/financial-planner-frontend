import { describe, expect, it } from 'vitest'
import type { LocalBill, LocalGoal, LocalIncomeStream } from '#/db/types'
import { planFunding } from '#/features/planning/data/funding'
import { DEFAULT_PLANNING_SETTINGS } from '#/features/wallets/api/types'
import type { PlanningSettings } from '#/features/wallets/api/types'
import {
  RATES,
  bill,
  goal,
  income,
  m,
} from '#/features/planned/testing/fixtures'
import { isoOf } from './dates'
import { desiredPlanned, paydaysOf } from './generate'
import type { DesiredPlanned } from './generate'

const SEP_24 = new Date(2026, 8, 24)
const JUN_12 = new Date(2026, 5, 12)
const SALARY = income({ amount: m(20000), day: 27, walletId: 'w1' })

const generate = (
  opts: {
    goals?: LocalGoal[]
    bills?: LocalBill[]
    income?: LocalIncomeStream[]
    today?: Date
    userId?: string
    /** Saved so far per goal; the Umrah goal starts with SR 1,000. */
    progress?: Record<string, number>
    settings?: Partial<PlanningSettings>
  } = {},
): DesiredPlanned[] => {
  const today = isoOf(opts.today ?? SEP_24)
  const goals = opts.goals ?? []
  const bills = opts.bills ?? []
  const streams = opts.income ?? []
  const settings = { ...DEFAULT_PLANNING_SETTINGS, ...opts.settings }
  const funding = planFunding({
    bills,
    goals,
    income: streams,
    planned: [],
    setAsides: [],
    progress: opts.progress ?? { umrah: m(1000) },
    index: new Map(),
    settings,
    base: 'SAR',
    rates: RATES,
    today,
  })
  return desiredPlanned({
    userId: opts.userId ?? 'u1',
    income: streams,
    bills,
    goals,
    funding,
    paydayMode: settings.paydayMode,
    today,
  })
}

const umrah = (over: Partial<LocalGoal> = {}) =>
  goal({
    id: 'umrah',
    name: 'Umrah trip',
    target: m(13000),
    dueDate: '2027-03-01',
    ...over,
  })

const rows = (all: DesiredPlanned[], ownerId: string, role: string) =>
  all.filter((r) => (r.goalId ?? r.billId) === ownerId && r.role === role)

const sum = (list: DesiredPlanned[]) => list.reduce((a, r) => a + r.amount, 0)

describe('desiredPlanned — goals', () => {
  it('plans a dated goal as one set-aside per payday through its date, flagged for review', () => {
    const out = generate({ goals: [umrah()], income: [SALARY], today: JUN_12 })
    const setAsides = rows(out, 'umrah', 'set_aside')

    // Jun 27 → Feb 27: nine paydays for the SR 12,000 left.
    expect(setAsides.map((r) => r.occurrence)).toEqual([
      '2026-06-27',
      '2026-07-27',
      '2026-08-27',
      '2026-09-27',
      '2026-10-27',
      '2026-11-27',
      '2026-12-27',
      '2027-01-27',
      '2027-02-27',
    ])
    expect(sum(setAsides)).toBe(m(12000))
    expect(setAsides[0]).toMatchObject({
      origin: 'goal',
      name: 'Umrah trip set-aside',
      currency: 'SAR',
      status: 'open',
      pinned: false,
      review: true,
      date: '2026-06-27',
    })
  })

  it('leaves set-asides out of review when pay is sorted automatically', () => {
    const out = generate({
      goals: [umrah()],
      income: [SALARY],
      settings: { paydayMode: 'auto' },
    })
    expect(rows(out, 'umrah', 'set_aside').every((r) => !r.review)).toBe(true)
  })

  it('funds the nearer goal first when pay is short, and the later one catches up', () => {
    // 1,000 a month: the near goal needs 750 a payday, the later one 300.
    const near = goal({
      id: 'near',
      target: m(3000),
      dueDate: '2026-10-01',
      position: 0,
    })
    const later = goal({
      id: 'later',
      target: m(3000),
      dueDate: '2027-04-01',
      position: 1,
    })
    const out = generate({
      goals: [near, later],
      income: [income({ amount: m(1000), day: 27 })],
      today: JUN_12,
      progress: {},
    })
    expect(rows(out, 'near', 'set_aside').map((r) => r.amount)).toEqual(
      Array(4).fill(m(750)),
    )
    const laterRows = rows(out, 'later', 'set_aside')
    expect(laterRows.slice(0, 4).map((r) => r.amount)).toEqual(
      Array(4).fill(m(250)),
    )
    expect(sum(laterRows)).toBe(m(3000))
  })

  it('counts settled progress, so a goal ahead of plan needs less', () => {
    const behind = rows(
      generate({ goals: [umrah()], income: [SALARY] }),
      'umrah',
      'set_aside',
    )
    const ahead = rows(
      generate({
        goals: [umrah()],
        income: [SALARY],
        progress: { umrah: m(4000) },
      }),
      'umrah',
      'set_aside',
    )
    // Sep 24: 12,000 left over six paydays (Sep 27 → Feb 27) is 2,000; with 3,000 more, 1,500.
    expect(behind[0].amount).toBe(m(2000))
    expect(ahead[0].amount).toBe(m(1500))
  })

  it('suggests the goal’s own save-in wallet on its set-asides', () => {
    const out = generate({
      goals: [umrah({ saveWalletId: 'savings' })],
      income: [SALARY],
    })
    expect(
      new Set(rows(out, 'umrah', 'set_aside').map((r) => r.walletId)),
    ).toEqual(new Set(['savings']))
  })

  it('rolls a goal without a date at its monthly amount within the horizon', () => {
    const fund = goal({ id: 'fund', amount: m(300) })
    const out = generate({ goals: [fund], income: [SALARY], progress: {} })
    expect(rows(out, 'fund', 'set_aside').map((r) => r.amount)).toEqual([
      m(300),
      m(300),
      m(300),
    ])
  })

  it('plans nothing for a goal that is closed or paused', () => {
    const out = generate({
      goals: [
        umrah({ closedAt: '2026-09-01' }),
        goal({ id: 'fund', amount: m(300), pausedAt: '2026-09-01' }),
      ],
      income: [SALARY],
    })
    expect(out.filter((r) => r.origin === 'goal')).toEqual([])
  })
})

describe('desiredPlanned — bills', () => {
  const rent = bill({
    id: 'rent',
    name: 'Rent',
    amount: m(3000),
    nextDue: '2026-09-01',
    walletId: 'w1',
  })

  it('plans a payment per occurrence from next due, an overdue one included', () => {
    const payments = rows(
      generate({ bills: [rent], income: [SALARY] }),
      'rent',
      'payment',
    )
    expect(payments.map((r) => r.occurrence)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ])
    expect(payments[0]).toMatchObject({
      origin: 'bill',
      name: 'Rent',
      walletId: 'w1',
      categoryId: rent.categoryId,
      amount: m(3000),
      review: false,
    })
  })

  it('covers each occurrence on the payday before it, into the save-in wallet', () => {
    const setAsides = rows(
      generate({
        bills: [{ ...rent, saveWalletId: 'w2' }],
        income: [SALARY],
      }),
      'rent',
      'set_aside',
    )
    // The overdue Sep 1 has no payday before it; Oct 1 is covered on Sep 27, Nov 1 on Oct 27.
    expect(setAsides.map((r) => [r.occurrence, r.amount / 100])).toEqual([
      ['2026-09-27', 3000],
      ['2026-10-27', 3000],
      ['2026-11-27', 3000],
    ])
    expect(new Set(setAsides.map((r) => r.walletId))).toEqual(new Set(['w2']))
  })

  it('plans the whole saving-up schedule of the next occurrence, past the horizon', () => {
    const insurance = bill({
      id: 'ins',
      amount: m(1200),
      frequency: 'annual',
      nextDue: '2027-06-01',
    })
    const setAsides = rows(
      generate({ bills: [insurance], income: [SALARY] }),
      'ins',
      'set_aside',
    )
    expect(setAsides.at(-1)?.occurrence).toBe('2027-05-27')
    expect(sum(setAsides)).toBe(m(1200))
  })

  it('plans a one-off once and nothing for a closed bill or after a bill ends', () => {
    const out = generate({
      bills: [
        bill({ id: 'once', frequency: null, nextDue: '2026-11-15' }),
        bill({ id: 'closed', closedAt: '2026-09-01' }),
        { ...rent, id: 'ending', endsOn: '2026-10-15' },
      ],
      income: [SALARY],
    })
    expect(rows(out, 'once', 'payment').map((r) => r.occurrence)).toEqual([
      '2026-11-15',
    ])
    expect(out.filter((r) => r.billId === 'closed')).toEqual([])
    expect(rows(out, 'ending', 'payment').map((r) => r.occurrence)).toEqual([
      '2026-09-01',
      '2026-10-01',
    ])
  })
})

describe('desiredPlanned — income', () => {
  it('plans each monthly payday within 90 days into the stream’s wallet', () => {
    const out = generate({ income: [SALARY] })
    expect(out.map((r) => [r.occurrence, r.role, r.walletId])).toEqual([
      ['2026-09-27', 'income', 'w1'],
      ['2026-10-27', 'income', 'w1'],
      ['2026-11-27', 'income', 'w1'],
    ])
    expect(out[0]).toMatchObject({
      origin: 'income',
      incomeStreamId: SALARY.id,
      name: 'Salary',
      amount: m(20000),
    })
  })

  it('pays a 31st payday on the last day of a 30-day month', () => {
    expect(
      paydaysOf({ day: 31, frequency: 'monthly' }, '2026-09-01', '2026-11-30'),
    ).toEqual(['2026-09-30', '2026-10-31', '2026-11-30'])
  })

  it('plans a weekly stream every seven days, on dates every day agrees on', () => {
    const fromSep = paydaysOf(
      { day: 3, frequency: 'weekly' },
      '2026-09-24',
      '2026-12-23',
    )
    const fromOct = paydaysOf(
      { day: 3, frequency: 'weekly' },
      '2026-10-02',
      '2026-12-31',
    )
    expect(fromSep.length).toBeGreaterThanOrEqual(12)
    for (let i = 1; i < fromSep.length; i++) {
      const gap =
        (new Date(fromSep[i]).getTime() - new Date(fromSep[i - 1]).getTime()) /
        86_400_000
      expect(gap).toBe(7)
    }
    // A day later the series is the same series, not a shifted one.
    expect(fromOct.filter((d) => d <= '2026-12-23')).toEqual(
      fromSep.filter((d) => d >= '2026-10-02'),
    )
  })

  it('anchors longer cadences on fixed calendar months', () => {
    expect(
      paydaysOf(
        { day: 15, frequency: 'quarterly' },
        '2026-09-24',
        '2027-09-24',
      ),
    ).toEqual(['2026-10-15', '2027-01-15', '2027-04-15', '2027-07-15'])
  })

  it('stops paydays after the stream’s last one', () => {
    const out = generate({ income: [{ ...SALARY, endsOn: '2026-10-27' }] })
    expect(out.map((r) => r.occurrence)).toEqual(['2026-09-27', '2026-10-27'])
  })

  it('plans an anchored quarterly bonus in its own months, and re-plans when the anchor moves', () => {
    const bonus = income({
      id: 'bonus',
      label: 'Bonus',
      amount: m(5000),
      frequency: 'quarterly',
      day: 15,
      anchorDate: '2026-03-15',
    })
    const unanchored = generate({ income: [{ ...bonus, anchorDate: null }] })
    expect(unanchored.map((r) => r.occurrence)).toEqual(['2026-10-15'])

    const before = generate({ income: [bonus] })
    expect(before.map((r) => r.occurrence)).toEqual(['2026-12-15'])

    const moved = generate({
      income: [{ ...bonus, anchorDate: '2026-11-15' }],
    })
    expect(moved.map((r) => r.occurrence)).toEqual(['2026-11-15'])
    expect(moved[0].id).not.toBe(before[0].id)
  })
})

describe('desiredPlanned — ids', () => {
  it('gives the same occurrence the same id every time, and another user another id', () => {
    const input = { goals: [umrah()], income: [SALARY], today: JUN_12 }
    const a = generate(input).map((r) => r.id)
    const b = generate(input).map((r) => r.id)
    const other = generate({ ...input, userId: 'u2' }).map((r) => r.id)
    expect(b).toEqual(a)
    expect(new Set(a).size).toBe(a.length)
    expect(other.some((id) => a.includes(id))).toBe(false)
  })
})
