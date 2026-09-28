import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalIncomeStream, LocalRecurring } from '#/db/types'
import { planGoals } from '#/features/goals/data/selectors'
import {
  RATES,
  goal,
  income,
  m,
  recurring,
} from '#/features/planned/testing/fixtures'
import { desiredPlanned, paydaysOf } from './generate'
import type { DesiredPlanned } from './generate'
import { catId } from '#/features/categories/__fixtures__/categories'

const SEP_24 = new Date(2026, 8, 24)
const JUN_12 = new Date(2026, 5, 12)
const SALARY = income({ amount: m(20000), day: 27, walletId: 'w1' })

const generate = (
  opts: {
    goals?: LocalGoal[]
    income?: LocalIncomeStream[]
    recurrings?: LocalRecurring[]
    today?: Date
    userId?: string
    progress?: Record<string, number>
    legacy?: string[]
  } = {},
): DesiredPlanned[] => {
  const today = opts.today ?? SEP_24
  const goals = opts.goals ?? []
  const streams = opts.income ?? []
  return desiredPlanned({
    userId: opts.userId ?? 'u1',
    goals,
    income: streams,
    recurrings: opts.recurrings ?? [],
    plan: planGoals(streams, goals, 'SAR', RATES, today, opts.progress),
    base: 'SAR',
    rates: RATES,
    today,
    legacyMarkers: new Set(opts.legacy ?? []),
  })
}

const umrah = (over: Partial<LocalGoal> = {}) =>
  goal({
    id: 'umrah',
    name: 'Umrah trip',
    kind: 'onetime',
    target: m(13000),
    saved: m(1000),
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
      goals: [umrah({ target: m(10000), saved: 0, dueDate: '2027-02-01' })],
      income: [SALARY],
      today: JUN_12,
    })
    const setAsides = rows(out, 'umrah', 'set_aside')
    expect(setAsides.reduce((a, r) => a + r.amount, 0)).toBe(m(10000))
  })

  it('plans a monthly obligation as one payment per cycle within 90 days, no set-asides', () => {
    const rent = goal({
      id: 'rent',
      name: 'Rent',
      kind: 'recurring',
      amount: m(3500),
      frequency: 'monthly',
      nextDue: '2026-10-01',
    })
    const out = generate({ goals: [rent], income: [SALARY] })
    expect(rows(out, 'rent', 'set_aside')).toEqual([])
    expect(
      rows(out, 'rent', 'payment').map((r) => [r.occurrence, r.amount]),
    ).toEqual([
      ['2026-10-01', m(3500)],
      ['2026-11-01', m(3500)],
      ['2026-12-01', m(3500)],
    ])
    expect(rows(out, 'rent', 'payment')[0].name).toBe('Rent')
  })

  it('plans a quarterly obligation as monthly set-asides plus the quarterly payment', () => {
    const insurance = goal({
      id: 'ins',
      name: 'Insurance',
      kind: 'recurring',
      amount: m(3000),
      frequency: 'quarterly',
      nextDue: '2026-12-01',
    })
    const out = generate({ goals: [insurance], income: [SALARY] })
    expect(rows(out, 'ins', 'payment').map((r) => r.occurrence)).toEqual([
      '2026-12-01',
    ])
    expect(rows(out, 'ins', 'set_aside').map((r) => r.occurrence)).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ])
    expect(
      rows(out, 'ins', 'set_aside')
        .slice(0, 2)
        .map((r) => r.amount),
    ).toEqual([m(1500), m(1500)])
  })

  it('plans a custom 28-day obligation every 28 days from its next due, no set-asides', () => {
    const refill = goal({
      id: 'refill',
      name: 'Pills refill',
      kind: 'recurring',
      amount: m(250),
      frequency: 'custom',
      customInterval: 28,
      customUnit: 'day',
      nextDue: '2026-10-01',
    })
    const out = generate({ goals: [refill], income: [SALARY] })
    expect(rows(out, 'refill', 'set_aside')).toEqual([])
    expect(rows(out, 'refill', 'payment').map((r) => r.occurrence)).toEqual([
      '2026-10-01',
      '2026-10-29',
      '2026-11-26',
    ])
  })

  it('saves toward a custom every-2-months obligation between its payments', () => {
    const water = goal({
      id: 'water',
      name: 'Water bill',
      kind: 'recurring',
      amount: m(400),
      frequency: 'custom',
      customInterval: 2,
      customUnit: 'month',
      nextDue: '2026-10-31',
    })
    const out = generate({ goals: [water], income: [SALARY] })
    // Stepped from the anchor, so a 31st keeps landing on the month's own 31st or end.
    expect(rows(out, 'water', 'payment').map((r) => r.occurrence)).toEqual([
      '2026-10-31',
    ])
    expect(rows(out, 'water', 'set_aside').length).toBeGreaterThan(0)
  })

  it('plans the final payment of a pay-on-due obligation for its whole target, on its due date', () => {
    const tuition = umrah({
      id: 'tuition',
      name: 'Tuition',
      dueDate: '2027-01-10',
      payOnDue: true,
    })
    const out = generate({ goals: [tuition], income: [SALARY] })
    expect(rows(out, 'tuition', 'payment')).toEqual([
      expect.objectContaining({
        occurrence: '2027-01-10',
        amount: m(13000),
        role: 'payment',
      }),
    ])
  })

  it('still plans that payment once the saving is complete', () => {
    const done = umrah({ saved: m(13000), payOnDue: true })
    const out = generate({ goals: [done], income: [SALARY] })
    expect(rows(out, 'umrah', 'set_aside')).toEqual([])
    expect(rows(out, 'umrah', 'payment')).toHaveLength(1)
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
        progress: { umrah: m(3000) },
      }),
      'umrah',
      'set_aside',
    )
    // Sep 24: 12,000 left over Oct–Feb is 2,400/mo; with 3,000 settled, 1,800/mo.
    expect(behind[0].amount).toBe(m(2400))
    expect(ahead[0].amount).toBe(m(1800))
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

describe('desiredPlanned — Spending schedules', () => {
  it('plans a spend schedule as payments and an income one as paydays', () => {
    const gym = recurring({ id: 'gym', nextDue: '2026-10-05' })
    const rentIn = recurring({
      id: 'rent-in',
      type: 'income',
      categoryId: catId('salary'),
      nextDue: '2026-10-01',
    })
    const out = generate({ recurrings: [gym, rentIn] })
    expect(
      out.filter((r) => r.recurringId === 'gym').map((r) => r.role),
    ).toEqual(['payment', 'payment', 'payment'])
    expect(out.find((r) => r.recurringId === 'rent-in')).toMatchObject({
      role: 'income',
      categoryId: catId('salary'),
      walletId: 'w1',
    })
  })

  it('catches an auto-posted schedule up from its next due date', () => {
    const out = generate({
      recurrings: [
        recurring({ id: 'auto', autopost: true, nextDue: '2026-07-05' }),
      ],
    })
    expect(out.map((r) => r.occurrence).slice(0, 3)).toEqual([
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
    ])
  })

  it('stops a schedule on its end date, that date included', () => {
    const out = generate({
      recurrings: [
        recurring({
          id: 'ending',
          autopost: true,
          nextDue: '2026-09-05',
          endsOn: '2026-10-05',
        }),
      ],
    })
    expect(out.map((r) => r.occurrence)).toEqual(['2026-09-05', '2026-10-05'])
  })

  it('steps a custom schedule by its own interval', () => {
    const out = generate({
      recurrings: [
        recurring({
          id: 'every-4-weeks',
          autopost: true,
          nextDue: '2026-09-05',
          endsOn: '2026-11-30',
          frequency: 'custom',
          customInterval: 4,
          customUnit: 'week',
        }),
      ],
    })
    expect(out.map((r) => r.occurrence)).toEqual([
      '2026-09-05',
      '2026-10-03',
      '2026-10-31',
      '2026-11-28',
    ])
  })

  it('schedules nothing once a schedule is past its end date', () => {
    const out = generate({
      recurrings: [
        recurring({ id: 'over', nextDue: '2026-10-05', endsOn: '2026-09-30' }),
      ],
    })
    expect(out).toEqual([])
  })

  it('surfaces only the recent past of a schedule confirmed by hand', () => {
    const out = generate({
      recurrings: [recurring({ id: 'manual', nextDue: '2025-01-05' })],
    })
    expect(out[0].occurrence).toBe('2026-09-05')
  })

  it('marks an occurrence the old auto-poster already posted as done', () => {
    const out = generate({
      recurrings: [
        recurring({ id: 'auto', autopost: true, nextDue: '2026-09-05' }),
      ],
      legacy: ['recurring:auto:2026-09-05'],
    })
    expect(out.map((r) => [r.occurrence, r.status])).toEqual([
      ['2026-09-05', 'done'],
      ['2026-10-05', 'open'],
      ['2026-11-05', 'open'],
      ['2026-12-05', 'open'],
    ])
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
