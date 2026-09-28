/**
 * Row builders for the planned slice's tests. Test-only: nothing in the app imports this.
 */
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
  LocalPlanned,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { catId } from '#/features/categories/__fixtures__/categories'

let seq = 0
const next = (prefix: string) => `${prefix}${++seq}`

/** SAR/USD carry two minor digits, so whole amounts scale by 100. */
export const m = (whole: number) => whole * 100

export const RATES: Partial<Record<string, number>> = { SAR: 1, USD: 3.75 }

export const goal = (over: Partial<LocalGoal> = {}): LocalGoal => ({
  id: next('g'),
  name: 'Goal',
  kind: 'onetime',
  currency: 'SAR',
  color: '#EC4899',
  position: 0,
  amount: null,
  target: null,
  saved: 0,
  frequency: null,
  customInterval: null,
  customUnit: null,
  nextDue: null,
  dueDate: null,
  plannedAt: null,
  planAmount: null,
  planCount: null,
  planStart: null,
  setAsideDay: null,
  payOnDue: false,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const income = (
  over: Partial<LocalIncomeStream> = {},
): LocalIncomeStream => ({
  id: next('i'),
  label: 'Salary',
  amount: 0,
  currency: 'SAR',
  frequency: 'monthly',
  day: 27,
  color: '#1F9D6B',
  position: 0,
  walletId: null,
  anchorDate: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const recurring = (
  over: Partial<LocalRecurring> = {},
): LocalRecurring => ({
  id: next('r'),
  name: 'Gym',
  type: 'spend',
  amount: m(200),
  currency: 'SAR',
  categoryId: catId('health'),
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  endsOn: null,
  note: null,
  frequency: 'monthly',
  customInterval: null,
  customUnit: null,
  nextDue: '2026-10-05',
  autopost: false,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const wallet = (
  over: Partial<LocalBalanceNode> = {},
): LocalBalanceNode => ({
  id: next('w'),
  kind: 'wallet',
  parentId: null,
  name: 'Main Checking',
  color: '#1F9D6B',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 0,
  currency: 'SAR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const planned = (over: Partial<LocalPlanned> = {}): LocalPlanned => ({
  id: next('p'),
  origin: 'goal',
  role: 'set_aside',
  goalId: 'g',
  incomeStreamId: null,
  recurringId: null,
  walletId: null,
  name: 'Goal set-aside',
  amount: m(1500),
  currency: 'SAR',
  categoryId: null,
  occurrence: '2026-10-01',
  date: over.occurrence ?? '2026-10-01',
  status: 'open',
  pinned: false,
  note: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

export const tx = (over: Partial<LocalTransaction> = {}): LocalTransaction => ({
  id: next('t'),
  type: 'spend',
  amount: m(100),
  currency: 'SAR',
  categoryId: catId('other'),
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-09-01',
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

export const allocation = (
  over: Partial<LocalGoalAllocation> = {},
): LocalGoalAllocation => ({
  id: next('a'),
  goalId: 'g',
  source: 'wallet',
  walletId: 'w1',
  externalLabel: null,
  amount: m(100),
  currency: 'SAR',
  note: null,
  position: 0,
  date: '2026-09-01',
  plannedId: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})
