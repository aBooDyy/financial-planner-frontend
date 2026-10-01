import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import { planGoals } from '#/features/goals/data/fundingPlan'
import { RATES, goal, income, m } from '#/features/planned/testing/fixtures'
import { desiredPlanned, paydaysOf } from './generate'
import type { DesiredPlanned } from './generate'

const SEP_24 = new Date(2026, 8, 24)
const JUN_12 = new Date(2026, 5, 12)
const SALARY = income({ amount: m(20000), day: 27, walletId: 'w1' })

const generate = (
  opts: {
    goals?: LocalGoal[]
    income?: LocalIncomeStream[]
    today?: Date
    userId?: string
    /** Saved so far per goal; the Umrah goal starts with SR 1,000. */
    progress?: Record<string, number>
  } = {},
): DesiredPlanned[] => {
  const today = opts.today ?? SEP_24
  const goals = opts.goals ?? []
  const streams = opts.income ?? []
  const saved = opts.progress ?? { umrah: m(1000) }
  return desiredPlanned({
    userId: opts.userId ?? 'u1',
    income: streams,
    plan: planGoals(streams, goals, 'SAR', RATES, today, saved),
    base: 'SAR',
    rates: RATES,
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

const rows = (all: DesiredPlanned[], goalId: string, role: string) =>
  all.filter((r) => r.goalId === goalId && r.role === role)

describe('desiredPlanned — goals', () => {
  it('plans a one-time goal as one set-aside per schedule month, on its set-aside day', () => {
    const out = generate({ goals: [umrah()], income: [SALARY], today: JUN_12 })
    const setAsides = rows(out, 'umrah', 'set_aside')

    // The design's plan: SR 1,500 × 8, Jul 1 → Feb 1, and 8 × 1,500 + 1,000 = 13,000.
    expect(setAsides.map((r) => r.occurrence)).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ])
    expect(new Set(setAsides.map((r) => r.amount))).toEqual(new Set([m(1500)]))
    expect(setAsides[0]).toMatchObject({
      origin: 'goal',
      name: 'Umrah trip set-aside',
      currency: 'SAR',
      status: 'open',
      pinned: false,
      date: '2026-07-01',
    })
  })

  it('dates set-asides on the goal’s own set-aside day', () => {
    const out = generate({
      goals: [umrah({ setAsideDay: 15 })],
      income: [SALARY],
      today: JUN_12,
    })
    const dates = rows(out, 'umrah', 'set_aside').map((r) => r.occurrence)
    expect(dates[0]).toBe('2026-06-15')
    expect(dates.every((d) => d.endsWith('-15'))).toBe(true)
  })

  it('starts a deferred goal where the engine starts it and keeps its amounts', () => {
    // 1,000/mo of income: the near goal takes all of it for three months, then the later
    // one runs at 500/mo to its deadline.
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
      income: [income({ amount: m(1000) })],
      today: JUN_12,
    })
    const laterRows = rows(out, 'later', 'set_aside')
    expect(laterRows[0].occurrence).toBe('2026-10-01')
    expect(laterRows.map((r) => r.amount)).toEqual(Array(6).fill(m(500)))
    expect(rows(out, 'near', 'set_aside').map((r) => r.amount)).toEqual(
      Array(3).fill(m(1000)),
    )
  })

  it('adds up to exactly what is left when a split does not divide evenly', () => {
    const out = generate({
      goals: [umrah({ target: m(10000), dueDate: '2027-02-01' })],
      income: [SALARY],
      today: JUN_12,
      progress: {},
    })
    const setAsides = rows(out, 'umrah', 'set_aside')
    expect(setAsides.reduce((a, r) => a + r.amount, 0)).toBe(m(10000))
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
    // Sep 24: 12,000 left over Oct–Feb is 2,400/mo; with 3,000 more saved, 1,800/mo.
    expect(behind[0].amount).toBe(m(2400))
    expect(ahead[0].amount).toBe(m(1800))
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
