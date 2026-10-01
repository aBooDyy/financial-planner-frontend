import { describe, expect, it } from 'vitest'
import { RATES, tx, wallet } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  DINING,
  GROCERIES,
  SALARY,
  TAKEAWAY,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import type {
  Scope,
  SpendingInputs,
} from '#/features/transactions/data/selectors'
import { parseISO } from '#/features/transactions/data/planning'
import { buildCategoryTxns, categoryTxnsOf } from './categoryTxns'
import type { CategoryPick } from './categoryTxns'

const catalog = reportCatalog()
const main = wallet({ id: 'w1', name: 'Main' })
const side = wallet({ id: 'w2', name: 'Side' })
const inputs: SpendingInputs = {
  budgets: [],
  recurrings: [],
  nodes: [main, side],
  base: 'SAR',
  rates: RATES,
}
const period = {
  start: parseISO('2026-09-01'),
  dataEnd: parseISO('2026-09-30'),
}

const cafe = tx({ id: 'cafe', categoryId: CAFES, date: '2026-09-12' })
const takeaway = tx({ id: 'take', categoryId: TAKEAWAY, date: '2026-09-10' })
const onRoot = tx({ id: 'root', categoryId: DINING, date: '2026-09-05' })
const rows = [
  cafe,
  takeaway,
  onRoot,
  tx({ categoryId: GROCERIES, date: '2026-09-12' }),
  tx({ categoryId: CAFES, date: '2026-08-31' }),
  tx({ categoryId: CAFES, date: '2026-09-12', deleted: 1 }),
  tx({ categoryId: CAFES, date: '2026-09-12', walletId: 'w2' }),
  tx({ type: 'income', categoryId: SALARY, date: '2026-09-12' }),
]

const MAIN_ONLY: Scope = { type: 'wallet', id: 'w1' }

const ids = (pick: CategoryPick) =>
  categoryTxnsOf({
    rows,
    pick,
    catalog,
    scope: MAIN_ONLY,
    period,
    inputs,
  }).map((t) => t.id)

describe('categoryTxnsOf', () => {
  it('takes every live, in-scope row of the period rolled up to the root', () => {
    expect(ids({ type: 'spend', rootId: DINING, subId: null })).toEqual([
      'cafe',
      'take',
      'root',
    ])
  })

  it('narrows to one subcategory, the root id meaning the rows filed on it', () => {
    expect(ids({ type: 'spend', rootId: DINING, subId: CAFES })).toEqual([
      'cafe',
    ])
    expect(ids({ type: 'spend', rootId: DINING, subId: DINING })).toEqual([
      'root',
    ])
  })
})

describe('buildCategoryTxns', () => {
  const build = (subId: string | null) =>
    buildCategoryTxns({
      rows,
      pick: { type: 'spend', rootId: DINING, subId },
      catalog,
      scope: MAIN_ONLY,
      period,
      today: parseISO('2026-09-30'),
      inputs,
      dateFormat: 'dmy',
    })

  it('titles, counts and totals the pick, grouped by day newest first', () => {
    const view = build(null)
    expect(view.title).toBe('Dining')
    expect(view.countStr).toBe('3 transactions')
    expect(view.totalStr).toBe('SR 300.00')
    expect(view.list.groups.map((g) => g.rows.map((r) => r.id))).toEqual([
      ['cafe'],
      ['take'],
      ['root'],
    ])
  })

  it('names a subcategory after its root, the root itself as General', () => {
    expect(build(CAFES).title).toBe('Dining · Cafés')
    expect(build(DINING).title).toBe('Dining · General')
    expect(build(CAFES).countStr).toBe('1 transaction')
  })
})
