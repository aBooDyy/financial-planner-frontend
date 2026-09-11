import { describe, expect, it } from 'vitest'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import {
  buildBudgetsView,
  buildCashflow,
  buildRecurringView,
} from './selectors'
import type { SpendingData } from './selectors'

const TODAY = new Date(2026, 5, 12)
const ANCHOR = new Date(2026, 5, 1) // June 2026
const RATES = { SAR: 1, USD: 3.75 }
const ALL = { type: 'all' as const }

let seq = 0
const tx = (over: Partial<LocalTransaction>): LocalTransaction => ({
  id: `t${seq++}`,
  type: 'spend',
  amount: 0,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  date: '2026-06-10',
  note: null,
  source: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const wallet: LocalBalanceNode = {
  id: 'w1',
  kind: 'wallet',
  parentId: null,
  name: 'Main',
  color: '#1F9D6B',
  note: null,
  position: 0,
  collapsed: false,
  amount: 1_000_000,
  currency: 'SAR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
}

const data = (over: Partial<SpendingData>): SpendingData => ({
  txns: [],
  budgets: [],
  recurrings: [],
  nodes: [wallet],
  base: 'SAR',
  rates: RATES,
  ...over,
})

describe('buildCashflow', () => {
  it('splits income, consumption spend, and goal savings; net subtracts both outflows', () => {
    const txns = [
      tx({ type: 'income', amount: 1_200_000, category: 'salary' }),
      tx({ type: 'spend', amount: 240_000, category: 'groceries' }),
      tx({ type: 'spend', amount: 60_000, category: 'savings', goalId: 'g1' }),
    ]
    const view = buildCashflow(data({ txns }), ALL, ANCHOR, 'month')
    expect(view.incomeStr).toBe('SR 12,000')
    expect(view.spentStr).toBe('SR 2,400')
    expect(view.hasSaved).toBe(true)
    expect(view.savedStr).toBe('SR 600')
    // net = 12,000 − 2,400 − 600 = +9,000
    expect(view.netStr).toBe('+SR 9,000')
    expect(view.netPositive).toBe(true)
    expect(view.txCount).toBe(3)
  })

  it('only counts transactions inside the window', () => {
    const txns = [
      tx({ type: 'spend', amount: 100_000, date: '2026-06-10' }),
      tx({ type: 'spend', amount: 999_000, date: '2026-05-30' }), // outside June
    ]
    const view = buildCashflow(data({ txns }), ALL, ANCHOR, 'month')
    expect(view.spentStr).toBe('SR 1,000')
    expect(view.txCount).toBe(1)
  })
})

describe('buildBudgetsView', () => {
  const budget = (over: Partial<LocalBudget>): LocalBudget => ({
    id: 'b1',
    scopeType: 'category',
    target: 'groceries',
    period: 'monthly',
    customDays: null,
    limit: 150_000,
    currency: 'SAR',
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  })

  it('measures burn against the cap and flags over-limit', () => {
    const txns = [
      tx({ category: 'groceries', amount: 90_000, date: '2026-06-05' }),
      tx({ category: 'groceries', amount: 30_000, date: '2026-06-10' }),
      tx({ category: 'dining', amount: 50_000, date: '2026-06-10' }), // different category
    ]
    const view = buildBudgetsView(
      data({ txns, budgets: [budget({})] }),
      ALL,
      TODAY,
    )
    const row = view.rows[0]
    expect(row.spentStr).toBe('SR 1,200') // 120,000 of the 150,000 cap
    expect(row.over).toBe(false)
    expect(row.pctStr).toBe('80%')
  })

  it('excludes goal contributions from budget spend', () => {
    const txns = [
      tx({ category: 'groceries', amount: 90_000 }),
      tx({ category: 'groceries', amount: 80_000, goalId: 'g1' }), // a contribution, not budget spend
    ]
    const view = buildBudgetsView(
      data({ txns, budgets: [budget({})] }),
      ALL,
      TODAY,
    )
    expect(view.rows[0].spentStr).toBe('SR 900')
  })
})

describe('buildRecurringView', () => {
  const recurring = (over: Partial<LocalRecurring>): LocalRecurring => ({
    id: 'r1',
    name: 'Rent',
    type: 'spend',
    amount: 350_000,
    currency: 'SAR',
    category: 'housing',
    subcategory: null,
    walletId: 'w1',
    goalId: null,
    frequency: 'monthly',
    nextDue: '2026-06-25',
    autopost: true,
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  })

  it('normalizes spend cadence to a monthly figure and lists upcoming items', () => {
    const view = buildRecurringView(
      data({
        recurrings: [
          recurring({}),
          recurring({
            id: 'r2',
            name: 'Insurance',
            amount: 1_200_000,
            frequency: 'annual',
            nextDue: '2026-11-20',
          }),
        ],
      }),
      ALL,
      TODAY,
    )
    // 3,500/mo + 12,000/yr → 3,500 + 1,000 = 4,500/mo
    expect(view.monthlyStr).toBe('SR 4,500')
    expect(view.activeCount).toBe(2)
    // Only the June item is "upcoming this month".
    expect(view.upcoming).toHaveLength(1)
    expect(view.upcoming[0].name).toBe('Rent')
  })
})
