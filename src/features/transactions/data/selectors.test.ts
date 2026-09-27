import { describe, expect, it } from 'vitest'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalCategory,
  LocalGoal,
  LocalGoalAllocation,
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
  txTagOf,
} from './selectors'
import type {
  ActivityRow,
  AdjustmentRow,
  MonthGridView,
  Scope,
  SetAsideRow,
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
  categoryId: 'cat-groceries',
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-06-10',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
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
  archivedAt: null,
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
    id: `cat-${over.slug}`,
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
    id: 'dining-cafes',
    name: 'Cafés',
    parentId: 'cat-dining',
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

const allocationRow = (
  over: Partial<LocalGoalAllocation> = {},
): LocalGoalAllocation => ({
  id: `a${seq++}`,
  goalId: 'g1',
  source: 'wallet',
  walletId: 'w1',
  externalLabel: null,
  amount: 0,
  currency: 'SAR',
  note: null,
  position: 0,
  date: '2026-06-10',
  plannedId: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

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
  // Saved used to be goal-linked spends. Under ADR-3 a set-aside is a reservation (an
  // allocation), and a goal-linked spend is a payment that left the wallet — so Saved is now
  // the period's wallet reservations and every spend is Spent.
  it('splits income, spend and set-asides; net subtracts both outflows', () => {
    const txns = [
      tx({ type: 'income', amount: 1_200_000, categoryId: 'cat-salary' }),
      tx({ type: 'spend', amount: 240_000, categoryId: 'cat-groceries' }),
    ]
    const allocations = [
      allocationRow({ amount: 60_000, date: '2026-06-05' }),
      allocationRow({ amount: 99_000, date: '2026-05-31' }), // outside June
      allocationRow({
        amount: 50_000,
        source: 'external',
        walletId: null,
        externalLabel: 'Dad',
      }), // not held in a wallet
    ]
    const view = buildCashflow(
      data({ txns, allocations }),
      CATALOG,
      ALL,
      ANCHOR,
      'month',
    )
    expect(view.incomeStr).toBe('SR 12,000')
    expect(view.spentStr).toBe('SR 2,400')
    expect(view.hasSaved).toBe(true)
    expect(view.savedStr).toBe('SR 600')
    // net = 12,000 − 2,400 − 600 = +9,000
    expect(view.netStr).toBe('+SR 9,000')
    expect(view.netPositive).toBe(true)
    expect(view.txCount).toBe(2)
    expect(view.segments.map((s) => s.label)).toEqual([
      'Groceries',
      'Set aside',
    ])
  })

  it('counts a goal-linked payment as Spent, not Saved', () => {
    const txns = [
      tx({
        type: 'spend',
        amount: 350_000,
        categoryId: 'cat-groceries',
        goalId: 'rent',
      }),
    ]
    const view = buildCashflow(data({ txns }), CATALOG, ALL, ANCHOR, 'month')
    expect(view.spentStr).toBe('SR 3,500')
    expect(view.hasSaved).toBe(false)
    expect(view.netStr).toBe('−SR 3,500')
  })

  it('takes set-asides only from wallets in scope', () => {
    const allocations = [allocationRow({ amount: 60_000, walletId: 'w1' })]
    const scoped = buildCashflow(
      data({ allocations }),
      CATALOG,
      { type: 'wallet', id: 'elsewhere' },
      ANCHOR,
      'month',
    )
    expect(scoped.hasSaved).toBe(false)
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
    categoryId: 'cat-groceries',
    walletId: null,
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
      tx({ categoryId: 'cat-groceries', amount: 90_000, date: '2026-06-05' }),
      tx({ categoryId: 'cat-groceries', amount: 30_000, date: '2026-06-10' }),
      tx({ categoryId: 'cat-dining', amount: 50_000, date: '2026-06-10' }), // different category
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

  // Goal-linked spends used to be skipped as "contributions". A goal payment (rent) is money
  // that left the wallet under its own category (ADR-7), so it burns the budget like any spend;
  // money put aside is a reservation and never reaches a budget.
  it('counts goal-linked payments against the budget, not set-asides', () => {
    const txns = [
      tx({ categoryId: 'cat-groceries', amount: 90_000 }),
      tx({ categoryId: 'cat-groceries', amount: 80_000, goalId: 'g1' }),
    ]
    const view = buildBudgetsView(
      data({
        txns,
        budgets: [budget({})],
        allocations: [allocationRow({ amount: 500_000 })],
      }),
      CATALOG,
      ALL,
      TODAY,
    )
    expect(view.rows[0].spentStr).toBe('SR 1,700')
  })
})

describe('buildRecurringView', () => {
  const recurring = (over: Partial<LocalRecurring>): LocalRecurring => ({
    id: 'r1',
    name: 'Rent',
    type: 'spend',
    amount: 350_000,
    currency: 'SAR',
    categoryId: 'cat-housing',
    walletId: 'w1',
    goalId: null,
    merchantId: null,
    endsOn: null,
    note: null,
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

  it('keeps an ended schedule listed but out of the totals and upcoming', () => {
    const view = buildRecurringView(
      data({
        recurrings: [
          recurring({ endsOn: '2027-06-01' }),
          recurring({
            id: 'r2',
            name: 'Old gym',
            nextDue: '2026-06-28',
            endsOn: '2026-05-28',
          }),
        ],
      }),
      CATALOG,
      ALL,
      TODAY,
    )
    expect(view.monthlyStr).toBe('SR 3,500')
    expect(view.activeCount).toBe(1)
    expect(view.upcoming.map((u) => u.name)).toEqual(['Rent'])
    expect(view.rows.map((r) => [r.name, r.ended, r.untilStr])).toEqual([
      ['Rent', false, 'until Jun 1, 2027'],
      ['Old gym', true, null],
    ])
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

  it('marks every day outside the selected period as outside', () => {
    const picked = new Date(2026, 5, 10) // Wed 10 June
    const outsideKeys = (mode: 'month' | 'week' | 'day') => {
      const g = dayGrid(picked, mode)
      return [...g.rowsBefore, g.pivotRow, ...g.rowsAfter]
        .flat()
        .filter((c) => !c.outside)
        .map((c) => c.key)
    }
    expect(outsideKeys('day')).toEqual([ymd(picked)])
    expect(outsideKeys('week')).toEqual(
      [7, 8, 9, 10, 11, 12, 13].map((d) => ymd(new Date(2026, 5, d))),
    )
    expect(outsideKeys('month')).toHaveLength(30)
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

  it('totals each month and scales each shade against the year’s biggest net of its sign', () => {
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
    expect(july.tone).toBe('neg')
    expect(july.intensity).toBe(1)
    expect(march.tone).toBe('pos')
    expect(march.intensity).toBe(1) // the year's only gain
    expect(months[0].hasActivity).toBe(false)
    expect(months[0].tone).toBe('zero')
  })
})

describe('resolving through the catalog', () => {
  const list = (txns: LocalTransaction[]) =>
    buildActivityList(data({ txns }), CATALOG, ALL, ANCHOR, 'month', TODAY)

  it('rolls a subcategory into its parent’s donut segment and its parent’s budget', () => {
    const txns = [
      tx({ categoryId: 'dining-cafes', amount: 40_000 }),
      tx({ categoryId: 'cat-dining', amount: 60_000 }),
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
            categoryId: 'cat-dining',
            walletId: null,
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
      list([tx({ categoryId: 'dining-cafes' })]).groups[0].rows,
    )
    expect(rows[0].catLabel).toBe('Dining · Cafés')
    expect(rows[0].categoryId).toBe('dining-cafes')
  })

  it('titles a note-less row with its subcategory, not the parent', () => {
    const rows = txRows(
      list([tx({ categoryId: 'dining-cafes', note: null })]).groups[0].rows,
    )
    expect(rows[0].name).toBe('Cafés')
  })

  it('falls back to a generic name and icon when the category was deleted', () => {
    const rows = txRows(
      list([tx({ categoryId: 'cat-hobbies', amount: 10_000 })]).groups[0].rows,
    )
    expect(rows[0].catLabel).toBe('Deleted category')
    expect(CATALOG.get('cat-hobbies').icon).toBe(SPEND_CATEGORY_ICON)
  })

  it('keeps a row filed under another root out of the budget', () => {
    const budget: LocalBudget = {
      id: 'b1',
      scopeType: 'category',
      categoryId: 'cat-dining',
      walletId: null,
      period: 'monthly',
      customDays: null,
      limit: 200_000,
      currency: 'SAR',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    }
    const view = buildBudgetsView(
      data({
        txns: [
          tx({ categoryId: 'dining-cafes', amount: 10_000 }),
          tx({ categoryId: 'cat-groceries', amount: 50_000 }),
          tx({ categoryId: 'cat-hobbies', amount: 70_000 }),
        ],
        budgets: [budget],
      }),
      CATALOG,
      ALL,
      TODAY,
    )
    expect(view.rows[0]).toMatchObject({
      name: 'Dining',
      categoryId: 'cat-dining',
      spentStr: 'SR 100',
    })
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
      categoryId: null,
      walletId: 'w1',
      amount: 50_000,
      transferId,
      note,
    }),
    tx({
      type: 'transfer_in',
      categoryId: null,
      walletId: 'w2',
      amount: 50_000,
      transferId,
      note,
    }),
  ]
  const spend = tx({
    type: 'spend',
    amount: 10_000,
    categoryId: 'cat-groceries',
  })
  const withTransfer = (scopeTxns = [spend, ...legs('tr1')]) =>
    data({ nodes, txns: scopeTxns })

  const activity = (d: SpendingData, scope: Scope = ALL) =>
    buildActivityList(d, CATALOG, scope, ANCHOR, 'month', TODAY)
  const transferRows = (d: SpendingData, scope: Scope = ALL) =>
    activity(d, scope).groups.flatMap((g) =>
      g.rows.filter((r): r is TransferRow => r.kind === 'transfer'),
    )

  it('prefixes a wallet with its group across wallets, and drops it inside one', () => {
    const walletOf = (scope: Scope) =>
      activity(withTransfer([spend]), scope)
        .groups.flatMap((g) => g.rows)
        .map((r) => (r.kind === 'tx' ? r.walletName : null))
    expect(walletOf(ALL)).toEqual(['Everyday · Main'])
    expect(walletOf({ type: 'group', id: 'g1' })).toEqual(['Everyday · Main'])
    expect(walletOf({ type: 'wallet', id: 'w1' })).toEqual(['Main'])
  })

  it('leaves the cashflow hero to spend and income', () => {
    const view = buildCashflow(withTransfer(), CATALOG, ALL, ANCHOR, 'month')
    expect(view.spentStr).toBe('SR 100')
    expect(view.incomeStr).toBe('SR 0')
    expect(view.txCount).toBe(1)
    expect(view.segments.map((s) => s.key)).toEqual(['cat-groceries'])
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
      categoryId: null,
      walletId: 'w1',
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
      fromName: 'Everyday · Main',
      toName: 'Everyday · Savings',
      direction: 'neutral',
      amountStr: 'SR 500',
    })
    expect(view.groups[0].totalStr).toBe('−SR 100')
    expect(view.countStr).toBe('2 in June 2026')
  })

  it('treats a transfer between two ticked wallets as internal, and one leaving them as out', () => {
    const both: Scope = {
      type: 'accounts',
      picks: [
        { type: 'wallet', id: 'w1' },
        { type: 'wallet', id: 'w2' },
      ],
    }
    const mainAndCash: Scope = {
      type: 'accounts',
      picks: [
        { type: 'wallet', id: 'w1' },
        { type: 'wallet', id: 'w3' },
      ],
    }
    expect(transferRows(withTransfer(), both)[0].direction).toBe('neutral')
    expect(transferRows(withTransfer(), mainAndCash)[0].direction).toBe('out')
    expect(activity(withTransfer(), mainAndCash).groups[0].rows).toHaveLength(2)
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
    expect(view.emptyTitle).toBe('Nothing for this account')
  })

  it('shows a dash for a day that holds only transfers', () => {
    const view = activity(withTransfer(legs('tr1')))
    expect(view.groups[0].totalStr).toBe('—')
  })

  it('keeps the quick-add hint as the empty text across all accounts', () => {
    const view = activity(withTransfer([]))
    expect(view.empty).toBe(true)
    expect(view.emptyTitle).toBe('No transactions in this period')
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

describe('balance adjustments', () => {
  const other: LocalBalanceNode = {
    ...wallet,
    id: 'w2',
    name: 'Cash',
    color: '#0EA5E9',
  }
  const up = tx({
    type: 'adjustment_in',
    categoryId: null,
    amount: 30_000,
  })
  const down = tx({
    type: 'adjustment_out',
    categoryId: null,
    amount: 5_000,
    note: 'Matched statement',
  })
  const spend = tx({
    type: 'spend',
    amount: 10_000,
    categoryId: 'cat-groceries',
  })
  const withAdjustments = (txns = [spend, up, down]) =>
    data({ nodes: [wallet, other], txns })

  const activity = (d: SpendingData, scope: Scope = ALL) =>
    buildActivityList(d, CATALOG, scope, ANCHOR, 'month', TODAY)
  const adjustmentRows = (d: SpendingData, scope: Scope = ALL) =>
    activity(d, scope).groups.flatMap((g) =>
      g.rows.filter((r): r is AdjustmentRow => r.kind === 'adjustment'),
    )

  it('leaves the cashflow hero to spend and income', () => {
    const view = buildCashflow(withAdjustments(), CATALOG, ALL, ANCHOR, 'month')
    expect(view.spentStr).toBe('SR 100')
    expect(view.incomeStr).toBe('SR 0')
    expect(view.txCount).toBe(1)
  })

  it('keeps adjustments out of the breakdown donut', () => {
    const view = buildBreakdown(
      withAdjustments([up, down]),
      CATALOG,
      ALL,
      ANCHOR,
      'month',
    )
    expect(view.hasData).toBe(false)
  })

  it('never counts an adjustment as budget spend', () => {
    const budget: LocalBudget = {
      id: 'b1',
      scopeType: 'wallet',
      categoryId: null,
      walletId: 'w1',
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
      { ...withAdjustments(), budgets: [budget] },
      CATALOG,
      ALL,
      TODAY,
    )
    expect(view.rows[0].spentStr).toBe('SR 100')
  })

  it('leaves an adjustment-only day cold on the calendar', () => {
    const view = buildCalendar(
      withAdjustments([up, down]),
      ALL,
      ANCHOR,
      'month',
      true,
      TODAY,
    )
    const cells = [view.pivotRow, ...view.rowsBefore, ...view.rowsAfter].flat()
    expect(cells.some((c) => c.hasActivity)).toBe(false)
  })

  it('lists each adjustment as its own signed row, out of the day total', () => {
    const view = activity(withAdjustments())
    expect(view.groups[0].rows).toHaveLength(3)
    expect(view.groups[0].totalStr).toBe('−SR 100')
    expect(adjustmentRows(withAdjustments())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: up.id,
          name: 'Balance adjustment',
          walletName: 'Main',
          direction: 'in',
          amountStr: '+SR 300',
        }),
        expect.objectContaining({
          id: down.id,
          name: 'Matched statement',
          direction: 'out',
          amountStr: '−SR 50',
        }),
      ]),
    )
  })

  it('shows a dash for a day that holds only adjustments', () => {
    const view = activity(withAdjustments([up]))
    expect(view.groups[0].totalStr).toBe('—')
  })

  it('shows an adjustment only while its wallet is in scope', () => {
    expect(
      adjustmentRows(withAdjustments(), { type: 'wallet', id: 'w1' }),
    ).toHaveLength(2)
    expect(
      activity(withAdjustments([up]), { type: 'wallet', id: 'w2' }).empty,
    ).toBe(true)
  })
})

describe('confirmed planned items in Activity', () => {
  const allocation = (
    over: Partial<LocalGoalAllocation> = {},
  ): LocalGoalAllocation => ({
    id: `a${seq++}`,
    goalId: 'umrah',
    source: 'wallet',
    walletId: 'w1',
    externalLabel: null,
    amount: 150_000,
    currency: 'SAR',
    note: null,
    position: 0,
    date: '2026-06-10',
    plannedId: null,
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  })
  const umrah = { id: 'umrah', name: 'Umrah trip' } as LocalGoal
  const list = (over: Partial<SpendingData>, scope: Scope = ALL) =>
    buildActivityList(
      data({ goals: [umrah], ...over }),
      CATALOG,
      scope,
      ANCHOR,
      'month',
      TODAY,
    )

  it('lists a set-aside as its own row, kept out of the day total', () => {
    const view = list({
      txns: [tx({ type: 'spend', amount: 5_000, date: '2026-06-10' })],
      allocations: [allocation({ date: '2026-06-10' })],
    })
    expect(view.groups).toHaveLength(1)
    const [day] = view.groups
    expect(day.totalStr).toBe('−SR 50')
    const setAside = day.rows.find((r) => r.kind === 'set_aside') as SetAsideRow
    expect(setAside).toMatchObject({
      name: 'Umrah trip',
      sourceName: 'Main',
      amountStr: 'SR 1,500',
      goalId: 'umrah',
    })
  })

  it('gives a day holding only set-asides no total; they feed Saved, not Spent', () => {
    const d = data({
      goals: [umrah],
      allocations: [allocation({ date: '2026-06-03' })],
    })
    const view = buildActivityList(d, CATALOG, ALL, ANCHOR, 'month', TODAY)
    expect(view.groups[0].totalStr).toBe('—')
    const hero = buildCashflow(d, CATALOG, ALL, ANCHOR, 'month')
    expect(hero.spentStr).toBe('SR 0')
    expect(hero.txCount).toBe(0)
    expect(hero.savedStr).toBe('SR 1,500')
  })

  it('shows an external set-aside only when no account scope is set', () => {
    const allocations = [
      allocation({
        source: 'external',
        walletId: null,
        externalLabel: 'Dad’s help',
      }),
    ]
    expect(list({ allocations }).groups[0].rows[0]).toMatchObject({
      kind: 'set_aside',
      sourceName: 'Dad’s help',
    })
    expect(list({ allocations }, { type: 'wallet', id: 'w1' }).empty).toBe(true)
  })

  it('skips deleted and out-of-window set-asides', () => {
    const view = list({
      allocations: [
        allocation({ deleted: 1 }),
        allocation({ date: '2026-05-31' }),
      ],
    })
    expect(view.empty).toBe(true)
  })

  it('tags a confirmed payday, a confirmed payment and an unplanned goal spend', () => {
    expect(txTagOf(tx({ type: 'income', plannedId: 'p1' }))).toBe('income')
    expect(txTagOf(tx({ type: 'spend', plannedId: 'p2', goalId: 'g' }))).toBe(
      'obligation',
    )
    expect(txTagOf(tx({ type: 'spend', goalId: 'g' }))).toBe('goal')
    expect(txTagOf(tx({ type: 'spend' }))).toBeNull()
    const row = list({
      txns: [
        tx({
          type: 'income',
          categoryId: 'cat-salary',
          plannedId: 'p1',
          amount: 100,
        }),
      ],
    }).groups[0].rows[0] as TxRow
    expect(row.tag).toBe('income')
  })
})
