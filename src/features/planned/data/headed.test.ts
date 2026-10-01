import { describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { RATES, m, planned } from '#/features/planned/testing/fixtures'
import { buildHeaded } from './headed'
import { indexSettlements } from './settle'
import { buildPlannedList } from './views'

const TODAY = '2026-09-27'

const payment = (amount: number, over: Partial<LocalPlanned> = {}) =>
  planned({
    origin: 'bill',
    role: 'payment',
    goalId: null,
    amount,
    ...over,
  })
const setAside = (amount: number, over: Partial<LocalPlanned> = {}) =>
  planned({ amount, ...over })
const income = (amount: number, over: Partial<LocalPlanned> = {}) =>
  planned({ origin: 'income', role: 'income', goalId: null, amount, ...over })

function headed(rows: LocalPlanned[]) {
  const list = buildPlannedList({
    planned: rows,
    nodes: [],
    index: indexSettlements([], []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })
  return buildHeaded({
    rows: [...list.due, ...list.next, ...list.later],
    base: 'SAR',
    rates: RATES,
    today: TODAY,
  })
}

describe('buildHeaded', () => {
  it('splits income into payments, set-asides and what has no plan', () => {
    const view = headed([income(m(8000)), payment(m(4000)), setAside(m(2000))])
    expect(view.inStr).toBe('SR 8,000')
    expect(view.lines.map((l) => [l.key, l.valueStr])).toEqual([
      ['payments', 'SR 4,000'],
      ['set_asides', 'SR 2,000'],
      ['unplanned', 'SR 2,000'],
    ])
    expect(view.segments.map((s) => s.pct)).toEqual([50, 25, 25])
    expect(view.segments[0].pctStr).toBe('50% of income')
    expect(view.leftover).toMatchObject({ kind: 'spare', valueStr: 'SR 2,000' })
  })

  it('scales the bar to the plans when they outrun income', () => {
    const view = headed([income(m(1000)), payment(m(3000)), setAside(m(1000))])
    expect(view.lines.map((l) => l.key)).toEqual(['payments', 'set_asides'])
    expect(view.segments.map((s) => s.pct)).toEqual([75, 25])
    expect(view.leftover).toMatchObject({ kind: 'over', valueStr: 'SR 3,000' })
  })

  it('reads shares against the plans when no income is planned', () => {
    const view = headed([payment(m(100))])
    expect(view.segments[0].pctStr).toBe('100% of plans')
  })

  it('converts to base and keeps overdue items but not ones past the window', () => {
    const view = headed([
      payment(m(100), { currency: 'USD', occurrence: '2026-09-01' }),
      payment(m(999), { occurrence: '2026-12-01' }),
    ])
    expect(view.lines).toEqual([
      expect.objectContaining({ key: 'payments', valueStr: 'SR 375' }),
    ])
  })

  it('is empty with nothing in the window', () => {
    expect(headed([payment(m(1), { occurrence: '2027-01-01' })]).isEmpty).toBe(
      true,
    )
  })
})
