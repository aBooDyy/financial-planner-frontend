import { describe, expect, it } from 'vitest'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalCategory,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { buildCatalog } from '#/features/categories/data/catalog'
import { SPEND_CATEGORY_ICON } from '#/lib/icons/fallbacks'
import {
  buildActivityList,
  buildBreakdown,
  buildBudgetsView,
  buildCalendar,
  buildCashflow,
  buildRecurringView,
} from './selectors'
import type {
  ActivityRow,
  MonthGridView,
  Scope,
  SpendingData,
  TransferRow,
  TxRow,
} from './selectors'
import { ymd } from './planning'

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
  merchantId: null,
  date: '2026-06-10',
  note: null,
  source: null,
  transferId: null,
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
  icon: null,
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

let catSeq = 0
const cat = (
  over: Partial<LocalCategory> & { slug: string },
): LocalCategory => {
  catSeq += 1
  return {
    id: over.slug,
    parentId: null,
    name: over.slug,
    type: 'spend',
    color: '#64748B',
    icon: null,
    position: catSeq,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 'v1',
    dirty: 0,
    deleted: 0,
    ...over,
  }
}

/** The user's own two-level set, so every case resolves through real rows, not the built-ins. */
const CATALOG = buildCatalog([
  cat({ slug: 'groceries', name: 'Groceries', color: '#1F9D6B' }),
  cat({ slug: 'dining', name: 'Dining', color: '#F59E0B' }),
  cat({
    slug: 'cafes',
    id: 'cafes-id',
    name: 'Cafés',
    parentId: 'dining',
    icon: 'coffee',
  }),
  cat({ slug: 'housing', name: 'Housing', color: '#8B5CF6' }),
  cat({ slug: 'savings', name: 'Savings', color: '#0EA5E9' }),
  cat({ slug: 'salary', name: 'Salary', type: 'income', color: '#1F9D6B' }),
  // Deleted after transactions were filed under it — they must still render.
  cat({ slug: 'hobbies', name: 'Hobbies', deleted: 1 }),
])

const txRows = (rows: ActivityRow[]): TxRow[] =>
  rows.filter((r): r is TxRow => r.kind === 'tx')

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
    const view = buildCashflow(data({ txns }), CATALOG, ALL, ANCHOR, 'month')
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
    const view = buildCashflow(data({ txns }), CATALOG, ALL, ANCHOR, 'month')
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
      CATALOG,
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
      CATALOG,
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
      CATALOG,
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

describe('buildCalendar — day grid', () => {
  const dayGrid = (anchor: Date, mode: 'month' | 'week' | 'day') => {
    const view = buildCalendar(data({}), ALL, anchor, mode, false, TODAY)
    if (view.grid !== 'days') throw new Error('expected a day grid')
    return view
  }

  it('marks today as current in every mode, so it highlights like a focused week day', () => {
    const todayKey = ymd(TODAY)
    for (const mode of ['month', 'week', 'day'] as const) {
      const cells = dayGrid(TODAY, mode).pivotRow
      expect(cells.find((c) => c.key === todayKey)?.isCurrent).toBe(true)
    }
  })

  it('activates only the day you picked, and only in day mode', () => {
    const picked = new Date(2026, 5, 10)
    expect(
      dayGrid(picked, 'day')
        .pivotRow.filter((c) => c.isActive)
        .map((c) => c.key),
    ).toEqual([ymd(picked)])
    // Week and month view highlight nothing but today.
    for (const mode of ['week', 'month'] as const)
      expect(dayGrid(picked, mode).pivotRow.some((c) => c.isActive)).toBe(false)
  })

  it('builds the unfoldable month around the pivot week in week and day mode too', () => {
    for (const mode of ['month', 'week', 'day'] as const) {
      const g = dayGrid(new Date(2026, 5, 10), mode)
      const total = g.rowsBefore.length + g.rowsAfter.length + 1 /* pivot */
      expect(total).toBe(5) // June 2026 spans five Sun-start weeks
      expect(g.pivotRow).toHaveLength(7)
    }
  })
})

describe('buildCalendar — year grid', () => {
  const yearGrid = (txns: LocalTransaction[] = [], open = false) => {
    const view = buildCalendar(data({ txns }), ALL, ANCHOR, 'year', open, TODAY)
    if (view.grid !== 'months') throw new Error('expected a month grid')
    return view
  }
  const allMonths = (g: MonthGridView) =>
    [...g.rowsBefore, g.pivotRow, ...g.rowsAfter].flat()

  it('returns all twelve months of the anchor year, flagging the running one', () => {
    const months = allMonths(yearGrid())
    expect(months).toHaveLength(12)
    expect(months.map((m) => m.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ])
    expect(months.filter((m) => m.isCurrent).map((m) => m.key)).toEqual([
      '2026-06',
    ])
  })

  it('folds shut to the single row holding the running month', () => {
    const g = yearGrid()
    expect(g.pivotRow.map((m) => m.label)).toEqual(['May', 'Jun', 'Jul', 'Aug'])
    expect(g.rowsBefore).toHaveLength(1)
    expect(g.rowsAfter).toHaveLength(1)
    expect(g.caption).toContain('May – Aug 2026')
    expect(yearGrid([], true).caption).toBe('2026 — tap a month to open it.')
  })

  it('folds around January when the year on screen is not the current one', () => {
    const view = buildCalendar(
      data({}),
      ALL,
      new Date(2030, 7, 1),
      'year',
      false,
      TODAY,
    )
    if (view.grid !== 'months') throw new Error('expected a month grid')
    expect(view.pivotRow.map((m) => m.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
    ])
    expect(view.rowsBefore).toHaveLength(0)
    expect(view.rowsAfter).toHaveLength(2)
  })

  it('totals each month and scales spend heat against the year’s worst month', () => {
    const months = allMonths(
      yearGrid([
        tx({ type: 'income', amount: 1_000_000, date: '2026-03-04' }),
        tx({ type: 'spend', amount: 400_000, date: '2026-03-09' }),
        tx({ type: 'spend', amount: 800_000, date: '2026-07-09' }),
        tx({ type: 'spend', amount: 500_000, date: '2025-03-09' }), // other year
      ]),
    )
    const march = months[2]
    const july = months[6]
    expect(march.netStr).toBe('+6k') // SR 10,000 in − SR 4,000 out
    expect(march.hasBoth).toBe(true)
    expect(july.netStr).toBe('−8k')
    expect(july.intensity).toBe(1)
    expect(march.intensity).toBe(0.5)
    expect(months[0].hasActivity).toBe(false)
  })
})

describe('resolving through the catalog', () => {
  const list = (txns: LocalTransaction[]) =>
    buildActivityList(data({ txns }), CATALOG, ALL, ANCHOR, 'month', TODAY)

  it('rolls a subcategory into its parent’s donut segment and its parent’s budget', () => {
    const txns = [
      tx({ category: 'dining', subcategory: 'cafes', amount: 40_000 }),
      tx({ category: 'dining', amount: 60_000 }),
    ]

    const donut = buildBreakdown(data({ txns }), CATALOG, ALL, ANCHOR, 'month')
    expect(donut.items).toHaveLength(1)
    expect(donut.items[0].name).toBe('Dining')
    expect(donut.items[0].pctStr).toBe('100%')

    const budgets = buildBudgetsView(
      data({
        txns,
        budgets: [
          {
            id: 'b1',
            scopeType: 'category',
            target: 'dining',
            period: 'monthly',
            customDays: null,
            limit: 200_000,
            currency: 'SAR',
            createdAt: '',
            updatedAt: '',
            version: '',
            dirty: 0,
            deleted: 0,
          },
        ],
      }),
      CATALOG,
      ALL,
      TODAY,
    )
    expect(budgets.rows[0].spentStr).toBe('SR 1,000')
  })

  it('names the pair on the row a subcategory was filed under', () => {
    const rows = txRows(
      list([tx({ category: 'dining', subcategory: 'cafes' })]).groups[0].rows,
    )
    expect(rows[0].catLabel).toBe('Dining · Cafés')
    expect(rows[0].subcategoryId).toBe('cafes')
  })

  it('falls back to a generic name and icon when the category was deleted', () => {
    const rows = txRows(
      list([tx({ category: 'hobbies', amount: 10_000 })]).groups[0].rows,
    )
    expect(rows[0].catLabel).toBe('Other')
    expect(CATALOG.get('hobbies').icon).toBe(SPEND_CATEGORY_ICON)
  })
})

describe('transfers', () => {
  const group: LocalBalanceNode = {
    ...wallet,
    id: 'g1',
    kind: 'group',
    name: 'Everyday',
    amount: null,
    currency: null,
  }
  const main: LocalBalanceNode = { ...wallet, parentId: 'g1' }
  const savings: LocalBalanceNode = {
    ...wallet,
    id: 'w2',
    name: 'Savings',
    color: '#0EA5E9',
    parentId: 'g1',
  }
  const cash: LocalBalanceNode = { ...wallet, id: 'w3', name: 'Cash' }
  const nodes = [group, main, savings, cash]

  const legs = (transferId: string, note: string | null = null) => [
    tx({
      type: 'transfer_out',
      category: null,
      walletId: 'w1',
      amount: 50_000,
      transferId,
      note,
    }),
    tx({
      type: 'transfer_in',
      category: null,
      walletId: 'w2',
      amount: 50_000,
      transferId,
      note,
    }),
  ]
  const spend = tx({ type: 'spend', amount: 10_000, category: 'groceries' })
  const withTransfer = (scopeTxns = [spend, ...legs('tr1')]) =>
    data({ nodes, txns: scopeTxns })

  const activity = (d: SpendingData, scope: Scope = ALL) =>
    buildActivityList(d, CATALOG, scope, ANCHOR, 'month', TODAY)
  const transferRows = (d: SpendingData, scope: Scope = ALL) =>
    activity(d, scope).groups.flatMap((g) =>
      g.rows.filter((r): r is TransferRow => r.kind === 'transfer'),
    )

  it('leaves the cashflow hero to spend and income', () => {
    const view = buildCashflow(withTransfer(), CATALOG, ALL, ANCHOR, 'month')
    expect(view.spentStr).toBe('SR 100')
    expect(view.incomeStr).toBe('SR 0')
    expect(view.txCount).toBe(1)
    expect(view.segments.map((s) => s.key)).toEqual(['groceries'])
  })

  it('keeps transfers out of the breakdown donut', () => {
    const view = buildBreakdown(
      withTransfer(legs('tr1')),
      CATALOG,
      ALL,
      ANCHOR,
      'month',
    )
    expect(view.hasData).toBe(false)
  })

  it('never counts a transfer as budget spend', () => {
    const budget: LocalBudget = {
      id: 'b1',
      scopeType: 'wallet',
      target: 'w1',
      period: 'monthly',
      customDays: null,
      limit: 100_000,
      currency: 'SAR',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    }
    const view = buildBudgetsView(
      { ...withTransfer(), budgets: [budget] },
      CATALOG,
      ALL,
      TODAY,
    )
    expect(view.rows[0].spentStr).toBe('SR 100')
  })

  it('leaves a transfer-only day cold on the calendar', () => {
    const view = buildCalendar(
      withTransfer(legs('tr1')),
      ALL,
      ANCHOR,
      'month',
      true,
      TODAY,
    )
    const cells = [view.pivotRow, ...view.rowsBefore, ...view.rowsAfter].flat()
    expect(cells.some((c) => c.hasActivity)).toBe(false)
  })

  it('collapses both legs into one neutral row when the scope holds both sides', () => {
    const view = activity(withTransfer())
    const rows = view.groups[0].rows
    expect(rows).toHaveLength(2)
    const [transfer] = transferRows(withTransfer())
    expect(transfer).toMatchObject({
      id: 'tr1',
      name: 'Transfer',
      fromName: 'Main',
      toName: 'Savings',
      direction: 'neutral',
      amountStr: 'SR 500',
    })
    expect(view.groups[0].totalStr).toBe('−SR 100')
    expect(view.countStr).toBe('2 in June 2026')
  })

  it('titles a neutral transfer by its note', () => {
    const [row] = transferRows(withTransfer(legs('tr1', 'Rainy day')))
    expect(row.name).toBe('Rainy day')
  })

  it('treats a group holding both wallets as both sides', () => {
    const [row] = transferRows(withTransfer(), {
      type: 'group',
      id: 'g1',
    })
    expect(row.direction).toBe('neutral')
  })

  it('shows money leaving when only the source is in scope', () => {
    const [row] = transferRows(withTransfer(), {
      type: 'wallet',
      id: 'w1',
    })
    expect(row).toMatchObject({
      name: 'Transfer to Savings',
      direction: 'out',
      amountStr: '−SR 500',
    })
  })

  it('shows money arriving when only the destination is in scope', () => {
    const [row] = transferRows(withTransfer(), {
      type: 'wallet',
      id: 'w2',
    })
    expect(row).toMatchObject({
      name: 'Transfer from Main',
      direction: 'in',
      amountStr: '+SR 500',
    })
  })

  it('omits a transfer neither of whose wallets is in scope', () => {
    const view = activity(withTransfer(legs('tr1')), {
      type: 'wallet',
      id: 'w3',
    })
    expect(view.empty).toBe(true)
    expect(view.emptyText).toBe('Nothing for this account.')
  })

  it('shows a dash for a day that holds only transfers', () => {
    const view = activity(withTransfer(legs('tr1')))
    expect(view.groups[0].totalStr).toBe('—')
  })

  it('keeps the quick-add hint as the empty text across all accounts', () => {
    const view = activity(withTransfer([]))
    expect(view.empty).toBe(true)
    expect(view.emptyText).toMatch(/^No transactions in this period/)
  })

  it('shows a leg whose partner is gone as a transfer to a deleted account', () => {
    const [out] = legs('tr1')
    const [row] = transferRows(withTransfer([out]))
    expect(row).toMatchObject({
      name: 'Transfer to Deleted account',
      toName: 'Deleted account',
      direction: 'out',
      amountStr: '−SR 500',
    })
  })
})
