import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
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
import type { PeriodMode } from '#/features/transactions/constants'
import type { TransactionType } from '#/features/transactions/api/types'
import { totalsOf, walletDeltasFromTotals } from './ledgerTotals'
import {
  readLedgerWindow,
  readTransferLegs,
  readWalletDeltas,
} from './ledgerReads'
import { addDays, parseISO, periodOf, toIsoPeriod, ymd } from './planning'
import type { Period } from './planning'
import {
  buildActivityList,
  buildBreakdown,
  buildBudgetsView,
  buildCalendar,
  buildCashflow,
  buildRecurringView,
  scopeSections,
} from './selectors'
import type { Scope, SpendingData } from './selectors'
import { catId } from '#/features/categories/__fixtures__/categories'

/**
 * The Spending page reads only the dates its selectors look at. These pin that the narrower
 * read changes nothing: every selector, fed the window, answers exactly what it answers fed
 * the whole ledger.
 */

let rand = 7
const next = (): number => {
  rand = (rand * 1_103_515_245 + 12_345) % 2_147_483_648
  return rand / 2_147_483_648
}
const pick = <T>(items: ReadonlyArray<T>): T =>
  items[Math.floor(next() * items.length)]

const meta = {
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
} as const

const node = (
  over: Partial<LocalBalanceNode> & { id: string },
): LocalBalanceNode => ({
  kind: 'wallet',
  parentId: null,
  name: over.id,
  color: '#1F9D6B',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 500_000,
  currency: 'SAR',
  ...meta,
  ...over,
})

const NODES: LocalBalanceNode[] = [
  node({ id: 'bank', kind: 'group', amount: null, currency: null }),
  node({ id: 'jars', kind: 'group', parentId: 'bank', amount: null }),
  node({ id: 'checking', parentId: 'bank' }),
  node({ id: 'dollars', parentId: 'jars', currency: 'USD', amount: 20_000 }),
  node({ id: 'cash', position: 1 }),
  node({ id: 'closed', deleted: 1 }),
]
const WALLETS = ['checking', 'dollars', 'cash', 'closed']
const RATES = { SAR: 1, USD: 3.75, EUR: 4.1 }

const cat = (slug: string, type: 'spend' | 'income'): LocalCategory => ({
  id: catId(slug),
  parentId: null,
  slug,
  name: slug,
  type,
  color: '#64748B',
  icon: null,
  position: 0,
  ...meta,
})
const CATALOG = buildCatalog([
  cat('groceries', 'spend'),
  cat('dining', 'spend'),
  cat('rent', 'spend'),
  cat('salary', 'income'),
])

let seq = 0
const tx = (over: Partial<LocalTransaction>): LocalTransaction => ({
  // Random ids, so primary-key order is not date order.
  id: `t${Math.floor(next() * 2_176_782_336).toString(36)}-${seq++}`,
  type: 'spend',
  amount: 0,
  currency: 'SAR',
  categoryId: catId('groceries'),
  walletId: 'checking',
  goalId: null,
  merchantId: null,
  date: '2026-01-01',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  ...meta,
  ...over,
})

/** Two and a half years of mixed activity around the fixed todays below. */
function ledger(): LocalTransaction[] {
  const rows: LocalTransaction[] = []
  let day = new Date(2024, 9, 1)
  const end = new Date(2027, 3, 30)
  while (day <= end) {
    const date = ymd(day)
    const roll = next()
    const amount = 100 + Math.floor(next() * 90_000)
    const walletId = pick(WALLETS)
    const deleted = next() < 0.08 ? 1 : 0
    if (roll < 0.5)
      rows.push(
        tx({
          date,
          amount,
          walletId,
          deleted,
          currency: pick(['SAR', 'SAR', 'USD', 'EUR']),
          categoryId: catId(pick(['groceries', 'dining', 'rent'])),
          goalId: next() < 0.1 ? 'g1' : null,
          plannedId: next() < 0.1 ? 'p1' : null,
        }),
      )
    else if (roll < 0.65)
      rows.push(
        tx({
          date,
          amount,
          walletId,
          deleted,
          type: 'income',
          categoryId: catId('salary'),
        }),
      )
    else if (roll < 0.8) {
      const transferId = `x${seq}`
      const from = pick(WALLETS)
      const to = pick(WALLETS.filter((w) => w !== from))
      // Some legs land on different days, a few across a month boundary.
      const arrives = ymd(addDays(day, next() < 0.3 ? 3 : 0))
      const leg = (type: TransactionType, wallet: string, on: string) =>
        tx({
          date: on,
          amount,
          type,
          walletId: wallet,
          transferId,
          categoryId: null,
          deleted,
        })
      rows.push(leg('transfer_out', from, date))
      if (next() < 0.9) rows.push(leg('transfer_in', to, arrives))
    } else if (roll < 0.9)
      rows.push(
        tx({
          date,
          amount,
          walletId,
          deleted,
          categoryId: null,
          type: pick<TransactionType>(['adjustment_in', 'adjustment_out']),
        }),
      )
    day = addDays(day, 1 + Math.floor(next() * 3))
  }
  return rows
}

const budget = (over: Partial<LocalBudget> & { id: string }): LocalBudget => ({
  scopeType: 'overall',
  categoryId: null,
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: 400_000,
  currency: 'SAR',
  ...meta,
  ...over,
})

const BUDGETS: LocalBudget[] = [
  budget({ id: 'overall' }),
  budget({
    id: 'weekly',
    scopeType: 'category',
    categoryId: catId('dining'),
    walletId: null,
    period: 'weekly',
  }),
  budget({
    id: 'wallet45',
    scopeType: 'wallet',
    walletId: 'checking',
    period: 'custom',
    customDays: 45,
  }),
  budget({
    id: 'long',
    scopeType: 'category',
    categoryId: catId('rent'),
    walletId: null,
    period: 'custom',
    customDays: 400,
    currency: 'USD',
  }),
  budget({ id: 'unset', period: 'custom', customDays: null }),
  budget({ id: 'gone', period: 'custom', customDays: 900, deleted: 1 }),
]

const RECURRINGS: LocalRecurring[] = [
  {
    id: 'r1',
    name: 'Rent',
    type: 'spend',
    amount: 300_000,
    currency: 'SAR',
    categoryId: catId('rent'),
    walletId: 'checking',
    goalId: null,
    merchantId: null,
    endsOn: null,
    note: null,
    frequency: 'monthly',
    customInterval: null,
    customUnit: null,
    nextDue: '2026-10-01',
    autopost: true,
    ...meta,
  },
]

const GOALS = [{ id: 'g1', name: 'Trip', deleted: 0 } as LocalGoal]

const allocation = (
  date: string,
  walletId: string | null,
): LocalGoalAllocation => ({
  id: `a${date}${walletId}`,
  goalId: 'g1',
  source: walletId ? 'wallet' : 'external',
  walletId,
  externalLabel: walletId ? null : 'Dad',
  amount: 25_000,
  currency: 'SAR',
  note: null,
  position: 0,
  date,
  plannedId: null,
  ...meta,
})
const ALLOCATIONS = [
  allocation('2025-03-04', 'checking'),
  allocation('2026-09-02', 'dollars'),
  allocation('2026-09-20', null),
]

const TXNS = [
  ...ledger(),
  // Equal totals whose date order is the reverse of their id order: which one reads as the
  // top category follows the order the builders receive rows in.
  tx({
    id: 'a-dining',
    date: '2027-06-20',
    amount: 5_000,
    categoryId: catId('dining'),
  }),
  tx({ id: 'z-groceries', date: '2027-06-02', amount: 5_000 }),
]
/** A full-table read's order: the primary key. */
const byId = (a: LocalTransaction, b: LocalTransaction) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0
const LIVE_NODES = NODES.filter((n) => n.deleted === 0)
const inputs = {
  budgets: BUDGETS,
  recurrings: RECURRINGS,
  nodes: LIVE_NODES,
  base: 'SAR',
  rates: RATES,
  allocations: ALLOCATIONS,
  goals: GOALS,
} as const
const FULL: SpendingData = { ...inputs, txns: [...TXNS].sort(byId) }

const SCOPES: Scope[] = [
  { type: 'all' },
  { type: 'wallet', id: 'dollars' },
  { type: 'group', id: 'bank' },
  { type: 'group', id: 'jars' },
]

/** Today, anchors the page can reach, and deliberately awkward ones (year edges, a Wednesday week). */
const CASES: Array<{
  today: string
  anchor: string
  mode: PeriodMode
  /** A custom span's last day; a range mode's follows from its anchor. */
  end?: string
}> = [
  { today: '2026-09-26', anchor: '2026-09-01', mode: 'month' },
  { today: '2026-09-26', anchor: '2025-03-01', mode: 'month' },
  { today: '2026-09-26', anchor: '2024-10-01', mode: 'month' },
  { today: '2026-09-26', anchor: '2026-08-30', mode: 'week' },
  { today: '2026-09-26', anchor: '2025-12-28', mode: 'week' },
  { today: '2026-09-26', anchor: '2026-07-01', mode: 'week' },
  { today: '2026-09-26', anchor: '2026-02-28', mode: 'day' },
  { today: '2026-09-26', anchor: '2026-09-26', mode: 'day' },
  { today: '2026-09-26', anchor: '2025-01-01', mode: 'year' },
  { today: '2026-09-26', anchor: '2026-01-01', mode: 'year' },
  { today: '2026-03-31', anchor: '2026-03-01', mode: 'month' },
  { today: '2026-03-31', anchor: '2024-01-01', mode: 'year' },
  { today: '2027-01-02', anchor: '2026-12-27', mode: 'week' },
  { today: '2027-01-02', anchor: '2027-01-01', mode: 'month' },
  { today: '2026-09-26', anchor: '2027-06-01', mode: 'month' },
  // Custom spans: a day grid across months holding today, a month grid across a year edge,
  // and a long one ending today.
  {
    today: '2026-09-26',
    anchor: '2026-08-20',
    mode: 'custom',
    end: '2026-10-05',
  },
  {
    today: '2026-09-26',
    anchor: '2025-11-15',
    mode: 'custom',
    end: '2026-02-10',
  },
  {
    today: '2026-09-26',
    anchor: '2024-06-01',
    mode: 'custom',
    end: '2026-09-26',
  },
]

const periodOfCase = ({ anchor, mode, end }: (typeof CASES)[number]): Period =>
  mode === 'custom'
    ? { mode, start: parseISO(anchor), end: parseISO(end ?? anchor) }
    : periodOf(parseISO(anchor), mode)

beforeAll(async () => {
  await db.transactions.bulkPut(TXNS)
  await db.budgets.bulkPut(BUDGETS)
  await db.balanceNodes.bulkPut(NODES)
})

describe('readLedgerWindow', () => {
  it('leaves out every date nothing on screen reads', async () => {
    // March 2025's grid, then the 400-day budget back from today; nothing between or around.
    const inRead = (d: string) =>
      (d >= '2025-02-23' && d <= '2025-04-05') ||
      (d >= '2025-08-23' && d <= '2026-09-30')
    const { rows } = await readLedgerWindow(
      toIsoPeriod(periodOf(parseISO('2025-03-01'), 'month')),
      '2026-09-26',
    )
    expect(rows.length).toBe(TXNS.filter((t) => inRead(t.date)).length)
    expect(rows.every((t) => inRead(t.date))).toBe(true)
    expect(rows.length).toBeLessThan(TXNS.length)
  })

  it('hands rows over in primary-key order, with the budgets it read the ranges from', async () => {
    const win = await readLedgerWindow(
      toIsoPeriod(periodOf(parseISO('2026-09-01'), 'month')),
      '2026-09-26',
    )
    expect(win.rows).toEqual([...win.rows].sort(byId))
    const ids = (budgets: LocalBudget[]) => budgets.map((b) => b.id).sort()
    expect(ids(win.budgets)).toEqual(ids(BUDGETS))
  })

  it.each(CASES)(
    'every selector agrees with the full ledger — $mode $anchor, today $today',
    async (c) => {
      const p = periodOfCase(c)
      const period = toIsoPeriod(p)
      const win = await readLedgerWindow(period, c.today)
      expect(win).toMatchObject({ period, today: c.today })
      const part: SpendingData = { ...inputs, txns: win.rows }
      const t = parseISO(c.today)
      for (const scope of SCOPES) {
        const both = <TResult>(build: (data: SpendingData) => TResult) =>
          expect(build(part)).toEqual(build(FULL))
        both((d) => buildCashflow(d, CATALOG, scope, p))
        both((d) => buildBreakdown(d, CATALOG, scope, p))
        both((d) => buildActivityList(d, CATALOG, scope, p, t))
        both((d) => buildCalendar(d, scope, p, false, t))
        both((d) => buildCalendar(d, scope, p, true, t))
        both((d) => buildBudgetsView(d, CATALOG, scope, t))
        both((d) => buildRecurringView(d, CATALOG, scope, t))
      }
    },
  )
})

describe('readWalletDeltas', () => {
  it('reads the running totals, which agree with totals built from the whole ledger', async () => {
    const deltas = await readWalletDeltas(RATES)
    expect(deltas).toEqual(
      walletDeltasFromTotals(LIVE_NODES, totalsOf(TXNS), RATES),
    )
    expect(scopeSections(inputs, deltas)).toEqual(
      scopeSections(
        FULL,
        walletDeltasFromTotals(FULL.nodes, totalsOf(FULL.txns), FULL.rates),
      ),
    )
  })
})

describe('readTransferLegs', () => {
  it('finds both live legs even when they sit on different dates', async () => {
    const split = TXNS.find(
      (t) =>
        t.type === 'transfer_in' &&
        t.deleted === 0 &&
        TXNS.some(
          (o) =>
            o.transferId === t.transferId &&
            o.type === 'transfer_out' &&
            o.date.slice(0, 7) !== t.date.slice(0, 7),
        ),
    )
    expect(split).toBeDefined()
    const legs = await readTransferLegs(split!.transferId!)
    expect(legs.map((l) => l.type).sort()).toEqual([
      'transfer_in',
      'transfer_out',
    ])
  })
})
