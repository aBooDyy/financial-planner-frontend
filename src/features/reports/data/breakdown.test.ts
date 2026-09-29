import { describe, expect, it } from 'vitest'
import { NO_BASE } from '#/features/reports/data/delta'
import { m } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  DINING,
  FREELANCE,
  GROCERIES,
  SALARY,
  TAKEAWAY,
  flow,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import { ROOT_ITSELF_LABEL, buildCategoryBreakdown } from './breakdown'

const catalog = reportCatalog()

const cur = [
  flow({ categoryId: CAFES, amount: m(200) }),
  flow({ categoryId: CAFES, amount: m(100) }),
  flow({ categoryId: TAKEAWAY, amount: m(100) }),
  flow({ categoryId: DINING, amount: m(50) }),
  flow({ categoryId: GROCERIES, amount: m(250) }),
  flow({ type: 'income', categoryId: SALARY, amount: m(5000) }),
]

const prev = [
  flow({ categoryId: CAFES, amount: m(300) }),
  flow({ categoryId: TAKEAWAY, amount: m(200) }),
  flow({ type: 'income', categoryId: SALARY, amount: m(4000) }),
]

describe('buildCategoryBreakdown', () => {
  it('rolls subcategories up to their root, largest first, with shares', () => {
    const b = buildCategoryBreakdown(cur, null, 'spend', catalog, 'SAR')
    expect(b.totalStr).toBe('SR 700 total')
    expect(b.items.map((i) => [i.id, i.name, i.shareStr, i.amountStr])).toEqual(
      [
        [DINING, 'Dining', '64%', 'SR 450'],
        [GROCERIES, 'Groceries', '36%', 'SR 250'],
      ],
    )
    expect(b.items[0].color).toBe('#EF4444')
    expect(b.items[0].barPct).toBe(100)
    expect(b.items[1].barPct).toBeCloseTo((250 / 450) * 100)
  })

  it('lists the subcategories beneath a root, the root itself as General', () => {
    const [dining, groceries] = buildCategoryBreakdown(
      cur,
      null,
      'spend',
      catalog,
      'SAR',
    ).items
    expect(
      dining.subs.map((s) => [s.id, s.name, s.shareStr, s.amountStr]),
    ).toEqual([
      [CAFES, 'Cafés', '67%', 'SR 300'],
      [TAKEAWAY, 'Takeaway', '22%', 'SR 100'],
      [DINING, ROOT_ITSELF_LABEL, '11%', 'SR 50'],
    ])
    expect(ROOT_ITSELF_LABEL).toBe('General')
    expect(dining.subs.map((s) => s.barPct)).toEqual([
      100,
      (100 / 300) * 100,
      (50 / 300) * 100,
    ])
    expect(groceries.subs.map((s) => s.name)).toEqual(['General'])
  })

  it('counts and averages each root, with no deltas and no comparison', () => {
    const [dining, groceries] = buildCategoryBreakdown(
      cur,
      null,
      'spend',
      catalog,
      'SAR',
    ).items
    expect(dining.detail).toBe('4 transactions · avg SR 113')
    expect(groceries.detail).toBe('1 transaction · avg SR 250')
    expect(dining.delta).toBeNull()
    expect(dining.subs.every((s) => s.delta === null)).toBe(true)
  })

  it('compares each root and subcategory with the comparison period', () => {
    const [dining, groceries] = buildCategoryBreakdown(
      cur,
      prev,
      'spend',
      catalog,
      'SAR',
    ).items
    expect(dining.delta).toEqual({ text: '▼ 10%', tone: 'good' })
    expect(dining.detail).toBe(
      '4 transactions · avg SR 113 · SR 500 last period',
    )
    expect(dining.subs.map((s) => s.delta?.text)).toEqual([
      'No change',
      '▼ 50%',
      '–%',
    ])
    expect(groceries.delta).toEqual(NO_BASE)
    expect(groceries.detail).toBe(
      '1 transaction · avg SR 250 · SR 0 last period',
    )
  })

  it('reads income by its own categories, a rise being good', () => {
    const b = buildCategoryBreakdown(
      [
        ...cur,
        flow({ type: 'income', categoryId: FREELANCE, amount: m(1000) }),
      ],
      prev,
      'income',
      catalog,
      'SAR',
    )
    expect(b.totalStr).toBe('SR 6,000 total')
    expect(b.items.map((i) => [i.name, i.shareStr])).toEqual([
      ['Salary', '83%'],
      ['Freelance', '17%'],
    ])
    expect(b.items[0].delta).toEqual({ text: '▲ 25%', tone: 'good' })
  })

  it('is empty when nothing of the type was recorded', () => {
    const b = buildCategoryBreakdown([], null, 'spend', catalog, 'SAR')
    expect(b).toEqual({ totalStr: 'SR 0 total', items: [] })
  })
})
