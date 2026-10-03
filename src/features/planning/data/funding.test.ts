import { describe, expect, it } from 'vitest'
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalSetAside,
} from '#/db/types'
import { DEFAULT_PLANNING_SETTINGS } from '#/features/wallets/api/types'
import type { PlanningSettings } from '#/features/wallets/api/types'
import {
  RATES,
  bill,
  goal,
  income,
  m,
  planned,
  setAside,
  tx,
} from '#/features/planned/testing/fixtures'
import { indexSettlements } from '#/features/planned/data/settle'
import { planFunding, roundedSchedule, tracksOf } from './funding'
import type { FundingPlan, TrackPlan } from './funding'

const TODAY = '2026-10-02'
/** Paid on the 25th: slots Oct 25, Nov 25, Dec 25, … */
const SALARY = income({ id: 'salary', amount: m(12000), day: 25 })

type Opts = {
  bills?: LocalBill[]
  goals?: LocalGoal[]
  income?: LocalIncomeStream[]
  planned?: LocalPlanned[]
  setAsides?: LocalSetAside[]
  progress?: Record<string, number>
  settings?: Partial<PlanningSettings>
  today?: string
}

const plan = (o: Opts = {}): FundingPlan => {
  const setAsides = o.setAsides ?? []
  const txns = (o.planned ?? [])
    .filter((p) => p.status !== 'open' && p.role === 'payment')
    .map((p) => tx({ plannedId: p.id, amount: p.amount, billId: p.billId }))
  return planFunding({
    bills: o.bills ?? [],
    goals: o.goals ?? [],
    income: o.income ?? [SALARY],
    planned: o.planned ?? [],
    setAsides,
    progress: o.progress ?? {},
    index: indexSettlements(txns, setAsides),
    settings: { ...DEFAULT_PLANNING_SETTINGS, ...o.settings },
    base: 'SAR',
    rates: RATES,
    today: o.today ?? TODAY,
  })
}

/** A track's funded set-asides by slot date, whole units, zeros dropped. */
const funded = (p: FundingPlan, t: TrackPlan) =>
  roundedSchedule(t.funded)
    .map((amount, k) => [p.slots[k].date, amount / 100] as const)
    .filter(([, amount]) => amount > 0)

const RENT = bill({ id: 'rent', amount: m(3000), nextDue: '2026-11-01' })

describe('bill coverage', () => {
  it('covers a monthly bill whole on the payday before it is due', () => {
    const p = plan({ bills: [RENT] })
    const [nov, dec] = tracksOf(p, 'bill', 'rent')
    expect(funded(p, nov)).toEqual([['2026-10-25', 3000]])
    expect(funded(p, dec)).toEqual([['2026-11-25', 3000]])
    expect(nov.shortfall).toBe(0)
  })

  it('keeps a prepaid occurrence’s payday, so the next one is still covered on its own', () => {
    const p = plan({ bills: [{ ...RENT, nextDue: '2026-12-01' }] })
    const [dec] = tracksOf(p, 'bill', 'rent')
    expect(funded(p, dec)).toEqual([['2026-11-25', 3000]])
  })

  it('saves up for a yearly bill in equal installments each payday', () => {
    const insurance = bill({
      id: 'ins',
      amount: m(1200),
      frequency: 'annual',
      nextDue: '2027-03-01',
    })
    const p = plan({ bills: [insurance] })
    const [mar] = tracksOf(p, 'bill', 'ins')
    // Oct 25 … Feb 25: five paydays before Mar 1.
    expect(funded(p, mar)).toEqual([
      ['2026-10-25', 240],
      ['2026-11-25', 240],
      ['2026-12-25', 240],
      ['2027-01-25', 240],
      ['2027-02-25', 240],
    ])
  })

  it('saves up for a one-off five months out, and only for it', () => {
    const service = bill({
      id: 'svc',
      amount: m(1000),
      frequency: null,
      nextDue: '2027-03-10',
    })
    const p = plan({ bills: [service] })
    const tracks = tracksOf(p, 'bill', 'svc')
    expect(tracks).toHaveLength(1)
    const rows = funded(p, tracks[0])
    expect(rows).toHaveLength(5)
    // The installments add up to exactly the bill, whatever the rounding.
    expect(rows.reduce((a, [, x]) => a + x, 0)).toBe(1000)
  })

  it('has no payday for a bill due before the next one: not set aside yet', () => {
    const p = plan({
      bills: [bill({ id: 'phone', amount: m(150), nextDue: '2026-10-12' })],
    })
    const [oct] = tracksOf(p, 'bill', 'phone')
    expect(oct.occurrence).toBe('2026-10-12')
    expect(oct.end).toBe(-1)
    expect(oct.shortfall).toBe(m(150))
    // The next occurrence is covered on Oct 25 as usual.
    expect(funded(p, tracksOf(p, 'bill', 'phone')[1])).toEqual([
      ['2026-10-25', 150],
    ])
  })

  it('covers several weekly occurrences from the one payday before them', () => {
    const p = plan({
      bills: [
        bill({
          id: 'gym',
          amount: m(50),
          frequency: 'weekly',
          nextDue: '2026-10-27',
        }),
      ],
    })
    const tracks = tracksOf(p, 'bill', 'gym')
    const onOct25 = tracks.filter((t) => t.start === 0 && t.end === 0)
    // Oct 27, Nov 3, Nov 10, Nov 17, Nov 24 all fall before the Nov 25 payday.
    expect(onOct25.map((t) => t.occurrence)).toEqual([
      '2026-10-27',
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
    ])
  })

  it('subtracts what is already set aside for an occurrence: ahead lowers the rest', () => {
    const insurance = bill({
      id: 'ins',
      amount: m(1200),
      frequency: 'annual',
      nextDue: '2027-03-01',
    })
    const p = plan({
      bills: [insurance],
      setAsides: [
        setAside({
          goalId: null,
          billId: 'ins',
          occurrence: '2027-03-01',
          amount: m(700),
        }),
      ],
    })
    const [mar] = tracksOf(p, 'bill', 'ins')
    expect(mar.need).toBe(m(500))
    expect(funded(p, mar).map(([, x]) => x)).toEqual([100, 100, 100, 100, 100])
  })

  it('plans nothing for a settled occurrence, a closed bill, or one past its end', () => {
    const paid = planned({
      origin: 'bill',
      role: 'payment',
      goalId: null,
      billId: 'rent',
      occurrence: '2026-12-01',
      amount: m(3000),
      status: 'done',
    })
    const p = plan({
      bills: [
        { ...RENT, endsOn: '2027-01-15' },
        bill({ id: 'old', closedAt: '2026-09-01' }),
      ],
      planned: [paid],
    })
    expect(tracksOf(p, 'bill', 'rent').map((t) => t.occurrence)).toEqual([
      '2026-11-01',
      '2027-01-01',
    ])
    expect(tracksOf(p, 'bill', 'old')).toEqual([])
  })
})

describe('goals', () => {
  it('spreads what is left of a dated goal over the paydays before its date', () => {
    const umrah = goal({
      id: 'umrah',
      target: m(13000),
      dueDate: '2027-03-01',
    })
    const p = plan({ goals: [umrah], progress: { umrah: m(1000) } })
    const [t] = tracksOf(p, 'goal', 'umrah')
    expect(funded(p, t).map(([, x]) => x)).toEqual([
      2400, 2400, 2400, 2400, 2400,
    ])
    expect(t.completesAt).toBe(4)
  })

  it('draws a monthly amount per paycheck, converted for weekly pay', () => {
    const fund = goal({ id: 'fund', amount: m(520) })
    const weekly = income({
      id: 'weekly',
      amount: m(1000),
      frequency: 'weekly',
      anchorDate: '2026-10-05',
      day: 5,
    })
    const p = plan({ goals: [fund], income: [weekly] })
    const [t] = tracksOf(p, 'goal', 'fund')
    // 520 a month × 12 / 52 paychecks = 120 a paycheck.
    expect(funded(p, t).slice(0, 3)).toEqual([
      ['2026-10-05', 120],
      ['2026-10-12', 120],
      ['2026-10-19', 120],
    ])
    expect(t.completesAt).toBeNull()
  })

  it('stops an undated goal at its target', () => {
    const car = goal({ id: 'car', amount: m(1000), target: m(2500) })
    const p = plan({ goals: [car] })
    const [t] = tracksOf(p, 'goal', 'car')
    expect(funded(p, t).map(([, x]) => x)).toEqual([1000, 1000, 500])
    expect(t.completesAt).toBe(2)
  })

  it('plans nothing for a paused, closed or reached goal', () => {
    const p = plan({
      goals: [
        goal({ id: 'paused', amount: m(100), pausedAt: '2026-09-01' }),
        goal({ id: 'closed', amount: m(100), closedAt: '2026-09-01' }),
        goal({ id: 'reached', amount: m(100), target: m(500) }),
      ],
      progress: { reached: m(500) },
    })
    expect(p.tracks).toEqual([])
  })
})

describe('two-tier priority', () => {
  /** SR 4,000 a month: not enough for everything below. */
  const PAY = income({ id: 'pay', amount: m(4000), day: 25 })
  const gym = bill({
    id: 'gym',
    amount: m(500),
    mustPay: false,
    nextDue: '2026-11-01',
    position: 0,
  })
  const rent = bill({
    id: 'rent',
    amount: m(3000),
    nextDue: '2026-11-05',
    position: 1,
  })
  const emergency = goal({ id: 'emergency', amount: m(800), mustHave: true })
  const trip = goal({ id: 'trip', amount: m(600), position: 0 })

  it('funds must-pay bills, then must-have goals, then the rest', () => {
    const p = plan({
      bills: [gym, rent],
      goals: [emergency, trip],
      income: [PAY],
    })
    const first = (kind: 'bill' | 'goal', id: string) =>
      roundedSchedule(tracksOf(p, kind, id)[0].funded)[0] / 100
    expect(first('bill', 'rent')).toBe(3000)
    expect(first('goal', 'emergency')).toBe(800)
    // 200 is left for the nice-to-have tier: the earlier deadline (gym, Nov 1) first.
    expect(first('bill', 'gym')).toBe(200)
    expect(first('goal', 'trip')).toBe(0)
    expect(tracksOf(p, 'bill', 'gym')[0].shortfall).toBe(m(300))
  })

  it('funds a must-pay bill in full before pay stops, ahead of a nice-to-have goal', () => {
    // Pay ends after January; a one-off of 6,000 is due Apr 1.
    const ending = income({
      id: 'ending',
      amount: m(2000),
      day: 25,
      endsOn: '2027-01-31',
    })
    const deposit = bill({
      id: 'deposit',
      amount: m(6000),
      frequency: null,
      nextDue: '2027-04-01',
    })
    const holiday = goal({ id: 'holiday', amount: m(1000) })
    const p = plan({ bills: [deposit], goals: [holiday], income: [ending] })
    const [track] = tracksOf(p, 'bill', 'deposit')
    expect(track.shortfall).toBe(0)
    expect(
      roundedSchedule(track.funded).reduce((sum, a) => sum + a, 0),
    ).toBe(m(6000))
    // The goal gets only what the bill can spare.
    const goalTotal = roundedSchedule(
      tracksOf(p, 'goal', 'holiday')[0].funded,
    ).reduce((sum, a) => sum + a, 0)
    expect(goalTotal).toBe(m(2 * 2000 - (6000 - 2 * 2000)))
  })

  it('still records what the plan would need with income unlimited', () => {
    const p = plan({
      bills: [gym, rent],
      goals: [emergency, trip],
      income: [PAY],
    })
    const required = (kind: 'bill' | 'goal', id: string) =>
      tracksOf(p, kind, id)[0].required[0] / 100
    expect(required('goal', 'trip')).toBe(600)
    expect(required('bill', 'gym')).toBe(500)
  })
})

describe('income', () => {
  it('is unlimited with no income: everything is funded as needed', () => {
    const p = plan({ bills: [RENT], income: [] })
    expect(p.unlimited).toBe(true)
    expect(p.calendar.kind).toBe('month')
    expect(p.slots[0]).toEqual({ date: '2026-11-01', capacity: Infinity })
    // Due Nov 1 and the first slot is Nov 1: covered that day.
    expect(funded(p, tracksOf(p, 'bill', 'rent')[0])).toEqual([
      ['2026-11-01', 3000],
    ])
  })

  it('plans with the floor when income varies, covering bills a month ahead', () => {
    const p = plan({
      bills: [bill({ id: 'rent', amount: m(3000), nextDue: '2026-12-05' })],
      settings: { incomeVaries: true, incomeFloor: m(5000) },
    })
    expect(p.unlimited).toBe(false)
    expect(p.slots[0]).toEqual({ date: '2026-11-01', capacity: m(5000) })
    // December's rent is ready from November's income.
    expect(funded(p, tracksOf(p, 'bill', 'rent')[0])).toEqual([
      ['2026-11-01', 3000],
    ])
  })
})

describe('roundedSchedule', () => {
  it('rounds on the running total so the parts add up to the whole', () => {
    const parts = roundedSchedule([33333.33, 33333.33, 33333.34])
    expect(parts).toEqual([33333, 33334, 33333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100000)
  })
})
