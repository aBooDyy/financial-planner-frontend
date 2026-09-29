import { describe, expect, it } from 'vitest'
import { m } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  GROCERIES,
  SALARY,
  TAKEAWAY,
  flow,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import { LARGEST_COUNT, buildLargest } from './largest'

const catalog = reportCatalog()
const merchants = new Map([['mer1', 'Blue Bottle']])

describe('buildLargest', () => {
  it('lists the six biggest spends, largest first, never income', () => {
    const rows = [
      flow({
        id: 'income',
        type: 'income',
        categoryId: SALARY,
        amount: m(9000),
      }),
      ...[100, 800, 300, 700, 200, 600, 500, 400].map((v) =>
        flow({ id: `s${v}`, amount: m(v) }),
      ),
    ]
    const items = buildLargest(rows, catalog, merchants, 'SAR')
    expect(LARGEST_COUNT).toBe(6)
    expect(items.map((i) => i.id)).toEqual([
      's800',
      's700',
      's600',
      's500',
      's400',
      's300',
    ])
    expect(items[0].amountStr).toBe('SR 800')
  })

  it('titles a row by its merchant, else its note, else its category', () => {
    const items = buildLargest(
      [
        flow({
          id: 'a',
          amount: m(400),
          categoryId: CAFES,
          merchantId: 'mer1',
          note: 'Flat white',
        }),
        flow({
          id: 'b',
          amount: m(300),
          categoryId: CAFES,
          merchantId: 'gone',
          note: 'Latte',
        }),
        flow({ id: 'c', amount: m(200), categoryId: TAKEAWAY }),
        flow({ id: 'd', amount: m(100), categoryId: GROCERIES }),
      ],
      catalog,
      merchants,
      'SAR',
    )
    expect(items.map((i) => i.title)).toEqual([
      'Blue Bottle',
      'Latte',
      'Takeaway',
      'Groceries',
    ])
  })

  it('dates each row under its root category and colours it by the root', () => {
    const [item] = buildLargest(
      [flow({ amount: m(50), categoryId: CAFES, date: '2026-06-03' })],
      catalog,
      merchants,
      'SAR',
    )
    expect(item.sub).toBe('Jun 3 · Dining')
    expect(item.color).toBe('#EF4444')
    expect(item.icon).toBe(catalog.get(CAFES).icon)
  })
})
