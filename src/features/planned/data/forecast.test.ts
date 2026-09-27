import { describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { RATES, m, planned } from '#/features/planned/testing/fixtures'
import { buildForecast } from './forecast'
import { OUTLOOK_DAYS } from './outlook'
import { indexSettlements } from './settle'
import { buildPlannedList } from './views'

const TODAY = '2026-09-27'

const bill = (over: Partial<LocalPlanned>) =>
  planned({
    origin: 'recurring',
    role: 'payment',
    goalId: null,
    name: 'Rent',
    ...over,
  })

const payday = (over: Partial<LocalPlanned>) =>
  planned({
    origin: 'income',
    role: 'income',
    goalId: null,
    name: 'Salary',
    ...over,
  })

function forecast(rows: LocalPlanned[], balance: number, reserved = 0) {
  const list = buildPlannedList({
    planned: rows,
    goals: [],
    nodes: [],
    index: indexSettlements([], []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })
  return buildForecast({
    rows: [...list.due, ...list.next, ...list.later],
    balance,
    reserved,
    base: 'SAR',
    rates: RATES,
    today: TODAY,
  })
}

describe('buildForecast', () => {
  it('walks the balance day by day as bills and paydays land', () => {
    const view = forecast(
      [
        bill({ occurrence: '2026-10-01', amount: m(3000) }),
        payday({ occurrence: '2026-10-05', amount: m(8000) }),
      ],
      m(5000),
    )
    expect(view.days).toHaveLength(OUTLOOK_DAYS + 1)
    expect(view.days[0]).toMatchObject({
      dateStr: 'Today',
      balance: m(5000),
      deltaStr: '',
    })
    expect(view.days[4]).toMatchObject({
      dateStr: 'Oct 1',
      balance: m(2000),
      deltaStr: '−SR 3,000',
      namesStr: 'Rent',
    })
    expect(view.days[8].balance).toBe(m(10000))
    expect(view.lowIndex).toBe(4)
    expect(view.status.kind).toBe('clear')
    expect(view.isFlat).toBe(false)
  })

  it('lands overdue items today', () => {
    const view = forecast(
      [bill({ occurrence: '2026-09-20', amount: m(500) })],
      m(1000),
    )
    expect(view.days[0]).toMatchObject({ balance: m(500), namesStr: 'Rent' })
  })

  it('leaves set-asides and anything past the window out', () => {
    const view = forecast(
      [
        planned({ occurrence: '2026-10-01', amount: m(900) }),
        bill({ occurrence: '2026-11-15', amount: m(700) }),
      ],
      m(1000),
    )
    expect(view.isFlat).toBe(true)
    expect(view.days.every((d) => d.balance === m(1000))).toBe(true)
  })

  it('flags going below zero before dipping into goal money', () => {
    const view = forecast(
      [
        bill({ occurrence: '2026-09-29', amount: m(600) }),
        bill({ occurrence: '2026-10-03', amount: m(600), name: 'Loan' }),
      ],
      m(1000),
      m(800),
    )
    expect(view.status).toEqual({
      kind: 'short',
      text: 'Goes below zero on Oct 3',
    })
    expect(view.days[6].balanceStr).toBe('−SR 200')
    expect(view.lo).toBeLessThan(-m(200))
  })

  it('flags dipping into goal money when the balance stays above zero', () => {
    const view = forecast(
      [bill({ occurrence: '2026-09-27', amount: m(500) })],
      m(1000),
      m(800),
    )
    expect(view.status).toEqual({
      kind: 'reserved',
      text: 'Dips into goal money today',
    })
    expect(view.hi).toBeGreaterThan(m(800))
  })

  it('names the first two items of a day, in list order, and counts the rest', () => {
    const view = forecast(
      ['Rent', 'Gym', 'Netflix', 'Phone'].map((name) =>
        bill({ occurrence: '2026-10-01', amount: m(10), name }),
      ),
      m(1000),
    )
    expect(view.days[4].namesStr).toBe('Gym, Netflix and 2 more')
  })
})
