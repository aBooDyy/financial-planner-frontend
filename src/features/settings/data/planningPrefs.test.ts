import { describe, expect, it } from 'vitest'
import { m, tx } from '#/features/planned/testing/fixtures'
import {
  clampHorizonDays,
  incomeLookbackStart,
  lowestMonthlyIncome,
} from './planningPrefs'

const RATES = { SAR: 1, USD: 3.75 }

describe('clampHorizonDays', () => {
  it('holds a typed count to the bounds', () => {
    expect(clampHorizonDays('14', 7, 90)).toBe(14)
    expect(clampHorizonDays('3', 7, 90)).toBe(7)
    expect(clampHorizonDays('120', 7, 90)).toBe(90)
    expect(clampHorizonDays('', 7, 90)).toBeNull()
    expect(clampHorizonDays('x', 7, 90)).toBeNull()
  })
})

describe('lowestMonthlyIncome', () => {
  it('takes the lowest of the last six full months that had income, in base', () => {
    const income = (amount: number, date: string, currency = 'SAR') =>
      tx({ type: 'income', amount, date, currency })
    const rows = [
      income(m(9000), '2026-09-25'),
      income(m(1000), '2026-08-03'),
      income(m(5000), '2026-08-25'),
      income(m(2000), '2026-07-25', 'USD'), // SR 7,500
      income(m(100), '2026-03-25'), // seven months back: out
      income(m(50), '2026-10-01'), // this month: out
      tx({ type: 'spend', amount: m(10), date: '2026-09-02' }),
    ]
    expect(lowestMonthlyIncome(rows, '2026-10-02', 'SAR', RATES)).toBe(m(6000))
  })

  it('reads from the 1st six months back', () => {
    expect(incomeLookbackStart('2026-10-02')).toBe('2026-04-01')
    expect(incomeLookbackStart('2026-03-31')).toBe('2025-09-01')
  })

  it('has nothing to start from without income', () => {
    expect(lowestMonthlyIncome([], '2026-10-02', 'SAR', RATES)).toBeNull()
  })
})
