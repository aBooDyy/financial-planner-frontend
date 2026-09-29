import { describe, expect, it } from 'vitest'
import {
  CAFES,
  CARD,
  CASH,
  DINING,
  GROCERIES,
  MAIN,
  RESTAURANTS,
  SALARY,
  TODAY,
  budget,
  catalog,
  merchant,
  planned,
  recurring,
  sources,
  tx,
} from './__fixtures__/search'
import { SEARCH_ROW_CAP, buildSearchView } from './search'
import type { SearchSources } from './search'
import { EMPTY_SEARCH_FILTERS } from './types'
import type {
  SearchContext,
  SearchFilters,
  SearchGroupKey,
  SearchView,
} from './types'

type Run = {
  query?: string
  filters?: Partial<SearchFilters>
  wide?: boolean
  context?: SearchContext | null
}

const run = (src: Partial<SearchSources>, opts: Run = {}): SearchView =>
  buildSearchView(sources(src), {
    query: opts.query ?? '',
    filters: { ...EMPTY_SEARCH_FILTERS, ...opts.filters },
    wide: opts.wide ?? true,
    context: opts.context ?? null,
    today: TODAY,
    dateFormat: 'dmy',
  })

const groupOf = (view: SearchView, key: SearchGroupKey) =>
  view.groups.find((g) => g.key === key)

const keys = (view: SearchView, key: SearchGroupKey): string[] =>
  groupOf(view, key)?.rows.map((r) => r.key) ?? []

const ACTIVITY_MAIN: SearchContext = {
  view: 'activity',
  scope: { type: 'wallet', id: MAIN.id },
  scopeLabel: 'Main',
}

describe('buildSearchView — idle', () => {
  it('is idle with neither a query nor a filter, and lists nothing', () => {
    const view = run({ txns: [tx()] }, { query: '   ' })
    expect(view.idle).toBe(true)
    expect(view.groups).toEqual([])
    expect(view.empty).toBe(false)
    expect(view.idleText).toBe(
      'Search every transaction, budget, recurring item and account, whatever tab or account you are on.',
    )
  })

  it('names the tab and scope it narrows to', () => {
    const view = run({}, { wide: false, context: ACTIVITY_MAIN })
    expect(view.idleText).toBe(
      'Searching Activity in Main. Switch to Everywhere to include other tabs and accounts.',
    )
  })

  it('searches wide when there is no context, whatever `wide` says', () => {
    const view = run({}, { wide: false, context: null })
    expect(view.idleText).toMatch(/^Search every transaction/)
    expect(view.scopeNote).toBe('All tabs · all accounts · all dates')
  })
})

describe('buildSearchView — transactions', () => {
  const coffee = tx({
    id: 't-coffee',
    note: 'Morning Coffee',
    amount: 2450,
    date: '2026-09-12',
  })

  it.each([
    ['note, any case, trimmed', '  coffee '],
    ['leaf category', 'cafés'],
    ['root category', 'dining'],
    ['wallet name', 'main'],
    ['amount with its decimals', '24.50'],
    ['amount trimmed', '24.5'],
    ['amount whole part', '24'],
  ])('matches on the %s', (_, query) => {
    expect(keys(run({ txns: [coffee] }, { query }), 'transactions')).toEqual([
      'tx:t-coffee',
    ])
  })

  it('matches on the merchant, and titles an unnoted row with it', () => {
    const shop = merchant({ id: 'm-bb', displayName: 'Blue Bottle' })
    const view = run(
      { txns: [tx({ merchantId: 'm-bb' })], merchants: [shop] },
      { query: 'bottle' },
    )
    expect(view.groups[0].rows[0].title).toBe('Blue Bottle')
  })

  it('draws a spend with its leaf, wallet, date and a signed base amount', () => {
    const row = run({ txns: [coffee] }, { query: 'coffee' }).groups[0].rows[0]
    expect(row).toMatchObject({
      target: { kind: 'tx', id: 't-coffee' },
      title: 'Morning Coffee',
      sub: 'Cafés · Main · 12/09/2026',
      valueStr: '−€24.50',
      positive: false,
      color: '#E5484D',
      iconId: catalog.get(CAFES).icon,
    })
  })

  it('signs income positive', () => {
    const pay = tx({ type: 'income', categoryId: SALARY, amount: 120_000 })
    const row = run({ txns: [pay] }, { query: 'salary' }).groups[0].rows[0]
    expect(row.valueStr).toBe('+€1,200.00')
    expect(row.positive).toBe(true)
  })

  it('lists newest first, skipping deleted rows', () => {
    const view = run(
      {
        txns: [
          tx({ id: 'a', date: '2026-09-01' }),
          tx({ id: 'b', date: '2026-09-20' }),
          tx({ id: 'c', date: '2026-09-20' }),
          tx({ id: 'd', date: '2026-09-25', deleted: 1 }),
        ],
      },
      { query: 'main' },
    )
    expect(keys(view, 'transactions')).toEqual(['tx:c', 'tx:b', 'tx:a'])
  })

  it('folds a transfer into one row matched on either wallet', () => {
    const legs = [
      tx({
        id: 'l1',
        type: 'transfer_out',
        categoryId: null,
        transferId: 'x1',
        walletId: MAIN.id,
        amount: 5000,
        date: '2026-09-10',
      }),
      tx({
        id: 'l2',
        type: 'transfer_in',
        categoryId: null,
        transferId: 'x1',
        walletId: CASH.id,
        amount: 5000,
        date: '2026-09-10',
      }),
    ]
    const view = run({ txns: legs }, { query: 'cash' })
    expect(groupOf(view, 'transactions')?.rows).toEqual([
      {
        key: 'transfer:x1',
        target: { kind: 'transfer', transferId: 'x1' },
        title: 'Transfer',
        sub: 'Main → Cash · 10/09/2026',
        valueStr: '€50.00',
        positive: false,
        color: 'var(--fp-text-3)',
        iconId: null,
        transfer: true,
      },
    ])
  })

  it('opens an adjustment as one, titled "Balance adjustment" without a note', () => {
    const fix = tx({ id: 'adj', type: 'adjustment_in', categoryId: null })
    const row = run({ txns: [fix] }, { query: 'adjustment' }).groups[0].rows[0]
    expect(row.target).toEqual({ kind: 'adjustment', id: 'adj' })
    expect(row.title).toBe('Balance adjustment')
    expect(row.positive).toBe(true)
  })

  it('caps the rows but counts every match', () => {
    const txns = Array.from({ length: SEARCH_ROW_CAP + 5 }, () => tx())
    const group = groupOf(run({ txns }, { query: 'cafés' }), 'transactions')
    expect(group?.count).toBe(SEARCH_ROW_CAP + 5)
    expect(group?.rows).toHaveLength(SEARCH_ROW_CAP)
  })
})

describe('buildSearchView — the other groups', () => {
  it('lists accounts by name or group, valued at their live balance', () => {
    const view = run({ deltas: { [MAIN.id]: -2000 } }, { query: 'personal' })
    expect(view.groups.map((g) => g.key)).toEqual(['accounts'])
    expect(view.groups[0].rows.map((r) => r.title)).toEqual(['Main', 'Cash'])
    expect(view.groups[0].rows[0]).toMatchObject({
      target: { kind: 'account', id: MAIN.id },
      sub: 'Personal · switch to this account',
      valueStr: '€980.00',
    })
  })

  it('calls a wallet in no group an Account and leaves archived ones out', () => {
    const view = run(
      { nodes: [CARD, { ...CASH, parentId: null, archivedAt: '2026-01-01' }] },
      { query: 'a' },
    )
    expect(view.groups[0].rows).toHaveLength(1)
    expect(view.groups[0].rows[0].sub).toBe('Account · switch to this account')
  })

  it('lists only open planned items, soonest first', () => {
    const view = run(
      {
        planned: [
          planned({ id: 'p2', date: '2026-10-05' }),
          planned({ id: 'p1', date: '2026-10-01' }),
          planned({ id: 'p3', status: 'done' }),
        ],
      },
      { query: 'rent' },
    )
    expect(keys(view, 'planned')).toEqual(['planned:p1', 'planned:p2'])
    expect(view.groups[0].rows[0].sub).toBe('Planned · 01/10/2026')
  })

  it('lists one schedule once, at its soonest occurrence the filters keep', () => {
    const series = [
      planned({ id: 'n1', recurringId: 'r1', date: '2026-10-10' }),
      planned({ id: 'n2', recurringId: 'r1', date: '2026-11-10' }),
      planned({ id: 'n3', recurringId: 'r1', date: '2026-12-10' }),
    ]
    const soonest = run({ planned: series }, { query: 'rent' })
    expect(keys(soonest, 'planned')).toEqual(['planned:n1'])
    expect(soonest.total).toBe(1)

    const november = run(
      { planned: series },
      {
        query: 'rent',
        filters: {
          ...EMPTY_SEARCH_FILTERS,
          date: 'custom',
          from: '2026-11-01',
          to: '2026-11-30',
        },
      },
    )
    expect(keys(november, 'planned')).toEqual(['planned:n2'])
  })

  it('names budgets as the Budgets tab does, with the limit per period', () => {
    const view = run(
      {
        budgets: [
          budget({ id: 'overall' }),
          budget({ id: 'dining', scopeType: 'category', categoryId: DINING }),
          budget({
            id: 'cash',
            scopeType: 'wallet',
            walletId: CASH.id,
            period: 'weekly',
          }),
        ],
      },
      { query: '400' },
    )
    const rows = view.groups[0].rows
    expect(rows.map((r) => r.title)).toEqual([
      'Total spendable',
      'Dining',
      'Cash',
    ])
    expect(rows[0]).toMatchObject({
      sub: 'Budget · Monthly',
      valueStr: '€400.00/mo',
      color: 'var(--fp-text-3)',
    })
    expect(rows[2]).toMatchObject({ valueStr: '€400.00/wk', color: '#222222' })
  })

  it('draws a recurring item with its cadence and next date, matched on merchant', () => {
    const view = run(
      {
        recurrings: [recurring({ merchantId: 'm-gym', nextDue: '2026-10-05' })],
        merchants: [merchant({ id: 'm-gym', displayName: 'PureGym' })],
      },
      { query: 'puregym' },
    )
    expect(view.groups[0].rows[0].sub).toBe('Monthly · next 05/10/2026')
  })

  it('orders the groups Accounts, Transactions, Planned, Budgets, Recurring', () => {
    const view = run(
      {
        txns: [tx({ note: 'main thing' })],
        planned: [planned({ name: 'main plan' })],
        budgets: [budget({ scopeType: 'wallet', walletId: MAIN.id })],
        recurrings: [recurring({ name: 'main gym' })],
      },
      { query: 'main' },
    )
    expect(view.groups.map((g) => g.key)).toEqual([
      'accounts',
      'transactions',
      'planned',
      'budgets',
      'recurring',
    ])
  })
})

describe('buildSearchView — filters', () => {
  const spend = tx({ id: 's', amount: 1000, date: '2026-09-28' })
  const income = tx({
    id: 'i',
    type: 'income',
    categoryId: SALARY,
    date: '2026-08-01',
  })
  const transfer = tx({
    id: 'x',
    type: 'transfer_out',
    categoryId: null,
    transferId: 'tr',
  })

  it('work without a query, and say so in the headline', () => {
    const view = run({ txns: [spend, income] }, { filters: { type: 'spend' } })
    expect(view.idle).toBe(false)
    expect(keys(view, 'transactions')).toEqual(['tx:s'])
    expect(view.headline).toBe('1 result matching filters')
  })

  it('keep only the chosen type, dropping transfers and accounts', () => {
    const view = run(
      { txns: [spend, income, transfer] },
      { query: 'a', filters: { type: 'income' } },
    )
    expect(view.groups.map((g) => g.key)).toEqual(['transactions'])
    expect(keys(view, 'transactions')).toEqual(['tx:i'])
  })

  it('drop budgets for income, since a budget only caps spending', () => {
    const view = run(
      { budgets: [budget()] },
      { query: 'total', filters: { type: 'income' } },
    )
    expect(view.empty).toBe(true)
  })

  it('bound dates to the running month, the last N days, or a custom range', () => {
    const txns = [
      spend,
      income,
      tx({ id: 'old', date: '2026-07-15' }),
      tx({ id: 'aug', date: '2026-08-31' }),
    ]
    const ids = (filters: Partial<SearchFilters>) =>
      keys(run({ txns }, { filters }), 'transactions')
    expect(ids({ date: 'month' })).toEqual(['tx:s'])
    expect(ids({ date: '30' })).toEqual(['tx:s', 'tx:aug'])
    expect(ids({ date: '90' })).toEqual(['tx:s', 'tx:aug', 'tx:i', 'tx:old'])
    expect(
      ids({ date: 'custom', from: '2026-08-01', to: '2026-08-31' }),
    ).toEqual(['tx:aug', 'tx:i'])
    expect(ids({ date: 'custom', to: '2026-07-31' })).toEqual(['tx:old'])
  })

  it('test a recurring item by its next due date and drop budgets and accounts', () => {
    const view = run(
      {
        recurrings: [
          recurring({ id: 'soon', name: 'main a', nextDue: '2026-09-30' }),
          recurring({ id: 'later', name: 'main b', nextDue: '2026-11-01' }),
        ],
        budgets: [budget({ scopeType: 'wallet', walletId: MAIN.id })],
      },
      { query: 'main', filters: { date: 'month' } },
    )
    expect(view.groups.map((g) => g.key)).toEqual(['recurring'])
    expect(keys(view, 'recurring')).toEqual(['recurring:soon'])
  })

  it('match a root picked whole, or a child picked alone', () => {
    const txns = [
      tx({ id: 'cafe', categoryId: CAFES }),
      tx({ id: 'rest', categoryId: RESTAURANTS }),
      tx({ id: 'din', categoryId: DINING }),
      tx({ id: 'groc', categoryId: GROCERIES }),
      transfer,
    ]
    const ids = (filters: Partial<SearchFilters>) =>
      keys(run({ txns }, { filters }), 'transactions').sort()
    expect(ids({ categoryIds: [DINING] })).toEqual([
      'tx:cafe',
      'tx:din',
      'tx:rest',
    ])
    expect(ids({ subcategoryIds: [CAFES] })).toEqual(['tx:cafe'])
    expect(ids({ categoryIds: [GROCERIES], subcategoryIds: [CAFES] })).toEqual([
      'tx:cafe',
      'tx:groc',
    ])
  })

  it('keep a category budget when any part of its root is picked', () => {
    const src = {
      budgets: [
        budget({ id: 'dining', scopeType: 'category', categoryId: DINING }),
        budget({ id: 'all' }),
      ],
    }
    expect(
      keys(run(src, { filters: { subcategoryIds: [CAFES] } }), 'budgets'),
    ).toEqual(['budget:dining'])
    expect(
      keys(run(src, { filters: { categoryIds: [GROCERIES] } }), 'budgets'),
    ).toEqual([])
  })

  it('keep what touches a picked wallet — a transfer through either leg', () => {
    const legs = [
      { ...transfer, walletId: MAIN.id },
      tx({
        id: 'y',
        type: 'transfer_in',
        categoryId: null,
        transferId: 'tr',
        walletId: CASH.id,
      }),
    ]
    const view = run(
      {
        txns: [...legs, tx({ id: 'main-spend' })],
        budgets: [
          budget({ id: 'all' }),
          budget({ id: 'cash', scopeType: 'wallet', walletId: CASH.id }),
        ],
      },
      { filters: { walletIds: [CASH.id] } },
    )
    expect(keys(view, 'accounts')).toEqual([`account:${CASH.id}`])
    expect(keys(view, 'transactions')).toEqual(['transfer:tr'])
    expect(keys(view, 'budgets')).toEqual(['budget:cash'])
  })

  it('compare amounts in the base currency, open on an empty or invalid side', () => {
    const txns = [
      tx({ id: 'eur', amount: 3000 }),
      tx({ id: 'usd', amount: 3000, currency: 'USD', walletId: CARD.id }),
    ]
    const ids = (min: string, max: string) =>
      keys(run({ txns }, { filters: { min, max } }), 'transactions').sort()
    expect(ids('20', '')).toEqual(['tx:eur'])
    expect(ids('', '20')).toEqual(['tx:usd'])
    expect(ids('10', 'abc')).toEqual(['tx:eur', 'tx:usd'])
  })

  it('reports no matches for filters that match nothing', () => {
    const view = run({ txns: [spend] }, { filters: { min: '1000' } })
    expect(view.empty).toBe(true)
    expect(view.headline).toBe('No matches for these filters')
  })
})

describe('buildSearchView — headline and scope', () => {
  it('counts results for the query in typographic quotes', () => {
    expect(run({ txns: [tx(), tx()] }, { query: 'Main ' }).headline).toBe(
      '3 results for “Main”',
    )
    expect(run({}, { query: 'zzz' }).headline).toBe('No matches for “zzz”')
  })

  it('describes the date filter in the scope note', () => {
    expect(run({}, { query: 'a', filters: { date: '30' } }).scopeNote).toBe(
      'All tabs · all accounts · last 30 days',
    )
    expect(
      run(
        {},
        {
          query: 'a',
          filters: { date: 'custom', from: '2026-09-01', to: '2026-09-15' },
          wide: false,
          context: ACTIVITY_MAIN,
        },
      ).scopeNote,
    ).toBe('Activity · Main · 01/09/2026 – 15/09/2026')
  })
})

describe('buildSearchView — narrowed to the page', () => {
  const src = {
    txns: [
      tx({ id: 'main', note: 'lunch' }),
      tx({ id: 'cash', note: 'lunch', walletId: CASH.id }),
    ],
    recurrings: [recurring({ name: 'lunch club' })],
  }

  it("keeps the tab's group and scope, counting what Everywhere adds", () => {
    const view = run(src, {
      query: 'lunch',
      wide: false,
      context: ACTIVITY_MAIN,
    })
    expect(view.groups.map((g) => g.key)).toEqual(['transactions'])
    expect(keys(view, 'transactions')).toEqual(['tx:main'])
    expect(view.total).toBe(1)
    expect(view.moreElsewhere).toBe(2)
    expect(view.scopeNote).toBe('Activity · Main · all dates')
  })

  it('has nothing more elsewhere when already wide', () => {
    const view = run(src, { query: 'lunch', context: ACTIVITY_MAIN })
    expect(view.total).toBe(3)
    expect(view.moreElsewhere).toBe(0)
  })

  it("keeps overall and category budgets in any scope, a wallet's only in its own", () => {
    const view = run(
      {
        budgets: [
          budget({ id: 'all' }),
          budget({ id: 'dining', scopeType: 'category', categoryId: DINING }),
          budget({ id: 'cash', scopeType: 'wallet', walletId: CASH.id }),
          budget({ id: 'main', scopeType: 'wallet', walletId: MAIN.id }),
        ],
      },
      {
        query: '400',
        wide: false,
        context: {
          view: 'budgets',
          scope: { type: 'group', id: 'g-other' },
          scopeLabel: 'Other',
        },
      },
    )
    expect(keys(view, 'budgets')).toEqual(['budget:all', 'budget:dining'])
    expect(view.moreElsewhere).toBe(2)
  })

  it('matches a group scope on the wallets beneath it', () => {
    const view = run(src, {
      query: 'lunch',
      wide: false,
      context: {
        view: 'activity',
        scope: { type: 'group', id: 'g-personal' },
        scopeLabel: 'Personal',
      },
    })
    expect(keys(view, 'transactions').sort()).toEqual(['tx:cash', 'tx:main'])
  })
})
