import { describe, expect, it } from 'vitest'
import {
  bill,
  m,
  planned,
  setAside,
  tx,
} from '#/features/planned/testing/fixtures'
import {
  billCycles,
  cycleChip,
  estimateSuggestion,
  payChoices,
} from './billCycles'

const TODAY = '2026-10-30'

const rent = (over: Parameters<typeof bill>[0] = {}) =>
  bill({
    id: 'b',
    amount: m(400),
    frequency: 'monthly',
    nextDue: '2026-08-15',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  })

const row = (occurrence: string, status: 'open' | 'done' | 'skipped') =>
  planned({
    id: `p:${occurrence}`,
    origin: 'bill',
    role: 'payment',
    goalId: null,
    billId: 'b',
    occurrence,
    date: occurrence,
    amount: m(400),
    status,
  })

const cyclesOf = (
  args: Partial<Parameters<typeof billCycles>[0]> & {
    bill: ReturnType<typeof bill>
  },
) =>
  billCycles({
    planned: [],
    txns: [],
    setAsides: [],
    rates: {},
    today: TODAY,
    ...args,
  })

describe('billCycles', () => {
  it('lists every missed date as overdue, then what is coming', () => {
    const cycles = cyclesOf({ bill: rent() })
    expect(cycles.due.map((c) => c.occurrence)).toEqual([
      '2026-08-15',
      '2026-09-15',
      '2026-10-15',
    ])
    expect(cycles.upcoming.at(0)?.occurrence).toBe('2026-11-15')
    expect(cycles.upcoming).toHaveLength(4)
    expect(cycles.moreUpcoming).toBe(true)
  })

  it('tells paid, skipped and unrecorded past dates apart', () => {
    const cycles = cyclesOf({
      bill: rent({ nextDue: '2026-11-15' }),
      planned: [row('2026-10-15', 'done'), row('2026-09-15', 'skipped')],
      txns: [
        tx({
          id: 't',
          billId: 'b',
          plannedId: 'p:2026-10-15',
          amount: m(412),
          date: '2026-10-17',
        }),
      ],
    })
    expect(cycles.due).toEqual([])
    expect(
      cycles.past.map((c) => [c.occurrence, c.state, c.paid / 100]),
    ).toEqual([
      ['2026-10-15', 'paid', 412],
      ['2026-09-15', 'skipped', 0],
      ['2026-08-15', 'unrecorded', 0],
      ['2026-07-15', 'unrecorded', 0],
      ['2026-06-15', 'unrecorded', 0],
      ['2026-05-15', 'unrecorded', 0],
    ])
  })

  it('leaves out dates from before the bill existed until asked', () => {
    const b = rent({ nextDue: '2026-11-15', createdAt: '2026-10-01T00:00:00Z' })
    expect(cyclesOf({ bill: b }).past.map((c) => c.occurrence)).toEqual([
      '2026-10-15',
    ])
    expect(
      cyclesOf({ bill: b, beforeStart: true }).past.at(1)?.occurrence,
    ).toBe('2026-09-15')
  })

  it('does not invent a date beside a row whose day was moved', () => {
    const cycles = cyclesOf({
      bill: rent({ nextDue: '2026-11-15' }),
      planned: [row('2026-10-01', 'done')],
    })
    expect(cycles.past.map((c) => c.occurrence)).not.toContain('2026-10-15')
    expect(cycles.past.at(0)?.occurrence).toBe('2026-10-01')
  })

  it('keeps a date paid ahead of time among what is coming', () => {
    const cycles = cyclesOf({
      bill: rent({ nextDue: '2026-11-15' }),
      planned: [row('2026-12-15', 'done')],
    })
    expect(cycles.upcoming.map((c) => [c.occurrence, c.state])).toContainEqual([
      '2026-12-15',
      'paid',
    ])
  })

  it('reads what is held for a date, not what was freed', () => {
    const cycles = cyclesOf({
      bill: rent({ nextDue: '2026-11-15' }),
      setAsides: [
        setAside({
          id: 'live',
          goalId: null,
          billId: 'b',
          occurrence: '2026-11-15',
          amount: m(150),
        }),
        setAside({
          id: 'freed',
          goalId: null,
          billId: 'b',
          occurrence: '2026-11-15',
          amount: m(90),
          releasedAt: '2026-10-01',
        }),
      ],
    })
    const [next] = cycles.upcoming
    expect(next.setAside).toBe(m(150))
    expect(next.setAsides.map((a) => a.id)).toEqual(['live'])
    expect(cycleChip(next).label).toBe('Saving up')
  })

  it('takes a date its own amount, and marks only the rest as estimates', () => {
    const cycles = cyclesOf({
      bill: rent({ nextDue: '2026-11-15', amountVaries: true }),
      planned: [{ ...row('2026-11-15', 'open'), amount: m(430), pinned: true }],
    })
    expect(
      cycles.upcoming.slice(0, 2).map((c) => [c.amount / 100, c.estimate]),
    ).toEqual([
      [430, false],
      [400, true],
    ])
  })
})

describe('payChoices', () => {
  it('offers overdue, coming and unpaid earlier dates — never a paid one', () => {
    const groups = payChoices(
      cyclesOf({
        bill: rent({ nextDue: '2026-10-15' }),
        planned: [row('2026-09-15', 'done'), row('2026-08-15', 'skipped')],
      }),
      TODAY,
    )
    expect(groups.map((g) => g.label)).toEqual([
      'Overdue',
      'Coming up',
      'Earlier',
    ])
    expect(groups[0].choices[0]).toEqual({
      occurrence: '2026-10-15',
      label: 'Oct 15 · Overdue',
    })
    const earlier = groups[2].choices.map((c) => c.occurrence)
    expect(earlier).toContain('2026-08-15')
    expect(earlier).not.toContain('2026-09-15')
  })
})

describe('estimateSuggestion', () => {
  const paid = (amount: number) =>
    ({ state: 'paid', paid: m(amount) }) as Parameters<
      typeof estimateSuggestion
    >[1][number]

  it('offers the average of the last payments once it has drifted', () => {
    const b = { amount: m(400), amountVaries: true }
    expect(
      estimateSuggestion(b, [paid(500), paid(460), paid(480), paid(100)]),
    ).toBe(m(480))
  })

  it('stays quiet near the estimate, on one payment, or for a fixed bill', () => {
    expect(
      estimateSuggestion({ amount: m(400), amountVaries: true }, [
        paid(405),
        paid(395),
      ]),
    ).toBeNull()
    expect(
      estimateSuggestion({ amount: m(400), amountVaries: true }, [paid(900)]),
    ).toBeNull()
    expect(
      estimateSuggestion({ amount: m(400), amountVaries: false }, [
        paid(900),
        paid(900),
      ]),
    ).toBeNull()
  })
})
