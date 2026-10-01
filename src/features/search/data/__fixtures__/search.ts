/**
 * Rows and sources for the search slice's tests. Test-only: nothing in the app imports this.
 */
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalMerchant,
  LocalPlanned,
  LocalTransaction,
} from '#/db/types'
import {
  catId,
  categoryRow,
} from '#/features/categories/__fixtures__/categories'
import { buildCatalog } from '#/features/categories/data/catalog'
import * as rows from '#/features/planned/testing/fixtures'
import type { SearchSources } from '../search'

export const TODAY = '2026-09-29'

export const DINING = catId('dining')
export const CAFES = catId('cafes', 'dining')
export const RESTAURANTS = catId('restaurants', 'dining')
export const GROCERIES = catId('groceries')
export const SALARY = catId('salary')

export const catalog = buildCatalog([
  categoryRow({ slug: 'dining', name: 'Dining', color: '#E5484D' }),
  categoryRow({
    id: CAFES,
    parentId: DINING,
    slug: 'cafes',
    name: 'Cafés',
    color: '',
  }),
  categoryRow({
    id: RESTAURANTS,
    parentId: DINING,
    slug: 'restaurants',
    name: 'Restaurants',
    color: '',
    position: 1,
  }),
  categoryRow({
    slug: 'groceries',
    name: 'Groceries',
    color: '#1F9D6B',
    position: 1,
  }),
  categoryRow({
    slug: 'salary',
    name: 'Salary',
    type: 'income',
    color: '#3B82F6',
    position: 2,
  }),
])

export const node = (over: Partial<LocalBalanceNode>): LocalBalanceNode =>
  rows.wallet({ currency: 'EUR', ...over })

export const PERSONAL = node({
  id: 'g-personal',
  kind: 'group',
  name: 'Personal',
  currency: null,
  amount: null,
})
export const MAIN = node({
  id: 'w-main',
  parentId: 'g-personal',
  name: 'Main',
  color: '#111111',
  amount: 100_000,
})
export const CASH = node({
  id: 'w-cash',
  parentId: 'g-personal',
  name: 'Cash',
  color: '#222222',
  position: 1,
})
export const CARD = node({
  id: 'w-card',
  name: 'Travel card',
  color: '#333333',
  currency: 'USD',
})
export const NODES = [PERSONAL, MAIN, CASH, CARD]

export const tx = (over: Partial<LocalTransaction> = {}): LocalTransaction =>
  rows.tx({ currency: 'EUR', walletId: MAIN.id, categoryId: CAFES, ...over })

export const planned = (over: Partial<LocalPlanned> = {}): LocalPlanned =>
  rows.planned({
    origin: 'manual',
    role: 'payment',
    goalId: null,
    name: 'Rent',
    currency: 'EUR',
    categoryId: null,
    walletId: MAIN.id,
    occurrence: '2026-10-01',
    ...over,
  })

let seq = 0
export const budget = (over: Partial<LocalBudget> = {}): LocalBudget => ({
  id: `b${++seq}`,
  scopeType: 'overall',
  categoryId: null,
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: 40_000,
  currency: 'EUR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const merchant = (over: Partial<LocalMerchant> = {}): LocalMerchant => ({
  id: `m${++seq}`,
  displayName: 'Blue Bottle',
  learnedCategoryId: null,
  learnedType: null,
  timesSeen: 1,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const sources = (over: Partial<SearchSources> = {}): SearchSources => ({
  txns: [],
  planned: [],
  budgets: [],
  nodes: NODES,
  merchants: [],
  deltas: {},
  base: 'EUR',
  rates: { EUR: 1, USD: 0.5 },
  catalog,
  ...over,
})
