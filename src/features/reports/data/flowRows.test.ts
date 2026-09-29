import { describe, expect, it } from 'vitest'
import { RATES, m, tx } from '#/features/planned/testing/fixtures'
import { GROCERIES, flow } from '#/features/reports/testing/fixtures'
import { flowRowsOf, rowsIn, sumOf } from './flowRows'

const ALL = () => true

describe('flowRowsOf', () => {
  it('keeps live income and spending, in the base currency', () => {
    const rows = flowRowsOf(
      [
        tx({
          id: 'a',
          type: 'spend',
          amount: m(100),
          currency: 'USD',
          categoryId: GROCERIES,
          merchantId: 'mer1',
          note: 'Weekly shop',
          date: '2026-09-03',
        }),
        tx({ id: 'b', type: 'income', amount: m(5000), date: '2026-09-01' }),
      ],
      ALL,
      'SAR',
      RATES,
    )
    expect(rows).toEqual([
      {
        id: 'a',
        date: '2026-09-03',
        type: 'spend',
        categoryId: GROCERIES,
        amount: m(375),
        merchantId: 'mer1',
        note: 'Weekly shop',
      },
      expect.objectContaining({ id: 'b', type: 'income', amount: m(5000) }),
    ])
  })

  it('leaves out transfers, adjustments, deleted rows and uncategorised rows', () => {
    const rows = flowRowsOf(
      [
        tx({ type: 'transfer_out', categoryId: null }),
        tx({ type: 'transfer_in', categoryId: null }),
        tx({ type: 'adjustment_in', categoryId: null }),
        tx({ type: 'adjustment_out', categoryId: null }),
        tx({ type: 'spend', deleted: 1 }),
        tx({ type: 'spend', categoryId: null }),
      ],
      ALL,
      'SAR',
      RATES,
    )
    expect(rows).toEqual([])
  })

  it('leaves out wallets outside the scope', () => {
    const rows = flowRowsOf(
      [tx({ id: 'in', walletId: 'w1' }), tx({ id: 'out', walletId: 'w2' })],
      (id) => id === 'w1',
      'SAR',
      RATES,
    )
    expect(rows.map((r) => r.id)).toEqual(['in'])
  })
})

describe('rowsIn', () => {
  it('keeps rows from the start through the data end, both included', () => {
    const rows = [
      flow({ id: 'before', date: '2026-08-31' }),
      flow({ id: 'first', date: '2026-09-01' }),
      flow({ id: 'last', date: '2026-09-29' }),
      flow({ id: 'after', date: '2026-09-30' }),
    ]
    const win = { start: new Date(2026, 8, 1), dataEnd: new Date(2026, 8, 29) }
    expect(rowsIn(rows, win).map((r) => r.id)).toEqual(['first', 'last'])
  })
})

describe('sumOf', () => {
  it('totals one type', () => {
    const rows = [
      flow({ type: 'spend', amount: 300 }),
      flow({ type: 'spend', amount: 200 }),
      flow({ type: 'income', amount: 1000 }),
    ]
    expect(sumOf(rows, 'spend')).toBe(500)
    expect(sumOf(rows, 'income')).toBe(1000)
  })
})
