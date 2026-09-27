import { describe, expect, it } from 'vitest'
import { RATES, m, tx } from '#/features/planned/testing/fixtures'
import { buildMonthlyFlow, flowWindowStart } from './monthlyFlow'

const TODAY = new Date(2026, 8, 27)

describe('buildMonthlyFlow', () => {
  it('reads from the first day of the month five months back', () => {
    expect(flowWindowStart(TODAY)).toBe('2026-04-01')
    expect(flowWindowStart(new Date(2026, 1, 3))).toBe('2025-09-01')
  })

  it('lays out six months ending with the running one', () => {
    const v = buildMonthlyFlow([], 'SAR', RATES, TODAY)
    expect(v.months.map((x) => x.label)).toEqual([
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
    ])
    expect(v.months[5].isCurrent).toBe(true)
    expect(v.months[5].title).toBe('September so far')
    expect(v.months[0].title).toBe('April 2026')
    expect(v.hasData).toBe(false)
  })

  it('sums income and spending per month in base currency', () => {
    const v = buildMonthlyFlow(
      [
        tx({ type: 'income', amount: m(5000), date: '2026-09-01' }),
        tx({ type: 'spend', amount: m(1000), date: '2026-09-10' }),
        tx({
          type: 'spend',
          amount: m(100),
          currency: 'USD',
          date: '2026-09-11',
        }),
        tx({ type: 'spend', amount: m(9000), date: '2026-08-15' }),
      ],
      'SAR',
      RATES,
      TODAY,
    )
    const sep = v.months[5]
    expect(sep.inStr).toBe('SR 5,000')
    expect(sep.outStr).toBe('SR 1,375')
    expect(sep.netStr).toBe('+SR 3,625')
    expect(sep.netPositive).toBe(true)
    const aug = v.months[4]
    expect(aug.netStr).toBe('−SR 9,000')
    expect(aug.outPct).toBe(100)
    expect(sep.inPct).toBeCloseTo((5000 / 9000) * 100)
    expect(v.scaleStr).toBe('SR 9K')
  })

  it('ignores transfers, adjustments, deleted rows and months outside the window', () => {
    const v = buildMonthlyFlow(
      [
        tx({ type: 'transfer_out', categoryId: null, date: '2026-09-02' }),
        tx({ type: 'adjustment_in', categoryId: null, date: '2026-09-02' }),
        tx({ type: 'spend', deleted: 1, date: '2026-09-02' }),
        tx({ type: 'spend', date: '2026-03-31' }),
      ],
      'SAR',
      RATES,
      TODAY,
    )
    expect(v.hasData).toBe(false)
  })
})
