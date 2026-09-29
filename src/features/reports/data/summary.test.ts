import { describe, expect, it } from 'vitest'
import { m } from '#/features/planned/testing/fixtures'
import { flow } from '#/features/reports/testing/fixtures'
import { buildSummary } from './summary'

const cur = [
  flow({ type: 'income', amount: m(5000) }),
  flow({ type: 'spend', amount: m(1000) }),
  flow({ type: 'spend', amount: m(300) }),
]
const prev = [
  flow({ type: 'income', amount: m(5000) }),
  flow({ type: 'spend', amount: m(2000) }),
]

describe('buildSummary', () => {
  it('totals the period against the comparison', () => {
    const s = buildSummary(cur, prev, 'Aug 1 – 29, 2026', 'SAR')
    expect(s.income).toEqual({
      amountStr: 'SR 5,000',
      delta: { text: 'No change', tone: 'neutral' },
    })
    expect(s.spending).toEqual({
      amountStr: 'SR 1,300',
      delta: { text: '▼ 35%', tone: 'good' },
    })
    expect(s.net).toEqual({
      label: 'Net · saved 74% of income',
      amountStr: '+SR 3,700',
      positive: true,
      delta: { text: '▲ SR 700', tone: 'good' },
    })
    expect(s.vs).toBe('vs Aug 1 – 29, 2026')
  })

  it('has no deltas without a comparison', () => {
    const s = buildSummary(cur, null, null, 'SAR')
    expect(s.income.delta).toBeNull()
    expect(s.spending.delta).toBeNull()
    expect(s.net.delta).toBeNull()
    expect(s.vs).toBeNull()
  })

  it('says when more was spent than earned, and plain Net without income', () => {
    const over = buildSummary(
      [flow({ type: 'income', amount: m(100) }), flow({ amount: m(300) })],
      null,
      null,
      'SAR',
    )
    expect(over.net.label).toBe('Net · spent more than earned')
    expect(over.net.amountStr).toBe('−SR 200')
    expect(over.net.positive).toBe(false)
    expect(buildSummary([flow()], null, null, 'SAR').net.label).toBe('Net')
  })
})
