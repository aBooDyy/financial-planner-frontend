import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode, LocalGoal, LocalTransaction } from '#/db/types'
import { contributionsByGoal, walletLiveBalances } from './ledger'

const RATES = { SAR: 1, USD: 3.75 }

let seq = 0
const wallet = (over: Partial<LocalBalanceNode>): LocalBalanceNode => ({
  id: `w${seq++}`,
  kind: 'wallet',
  parentId: null,
  name: 'Wallet',
  color: '#1F9D6B',
  note: null,
  position: 0,
  collapsed: false,
  amount: 0,
  currency: 'SAR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const tx = (over: Partial<LocalTransaction>): LocalTransaction => ({
  id: `t${seq++}`,
  type: 'spend',
  amount: 0,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  date: '2026-06-12',
  note: null,
  source: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const goal = (over: Partial<LocalGoal>): LocalGoal => ({
  id: `g${seq++}`,
  name: 'Goal',
  kind: 'onetime',
  currency: 'SAR',
  color: '#EC4899',
  position: 0,
  amount: null,
  target: null,
  saved: 0,
  frequency: null,
  nextDue: null,
  dueDate: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

describe('walletLiveBalances', () => {
  it('is opening balance plus signed transaction deltas', () => {
    const nodes = [wallet({ id: 'w1', amount: 1_600_000, currency: 'SAR' })]
    const txns = [
      tx({ walletId: 'w1', type: 'income', amount: 1_200_000 }),
      tx({ walletId: 'w1', type: 'spend', amount: 240_000 }),
      tx({ walletId: 'w1', type: 'spend', amount: 60_000, goalId: 'g1' }),
    ]
    const balances = walletLiveBalances(nodes, txns, RATES)
    expect(balances.w1).toBe(1_600_000 + 1_200_000 - 240_000 - 60_000)
  })

  it('converts a foreign-currency transaction into the wallet currency', () => {
    const nodes = [wallet({ id: 'w1', amount: 0, currency: 'SAR' })]
    // 100 USD spent from a SAR wallet at 3.75 → 375 SAR out.
    const txns = [
      tx({ walletId: 'w1', type: 'spend', amount: 10_000, currency: 'USD' }),
    ]
    expect(walletLiveBalances(nodes, txns, RATES).w1).toBe(-37_500)
  })

  it('ignores deleted transactions', () => {
    const nodes = [wallet({ id: 'w1', amount: 100_000 })]
    const txns = [
      tx({ walletId: 'w1', type: 'spend', amount: 50_000, deleted: 1 }),
    ]
    expect(walletLiveBalances(nodes, txns, RATES).w1).toBe(100_000)
  })
})

describe('contributionsByGoal', () => {
  it('sums goal-linked transactions in the goal currency', () => {
    const goals = [goal({ id: 'g1', currency: 'SAR' })]
    const txns = [
      tx({ goalId: 'g1', type: 'spend', amount: 50_000 }),
      tx({ goalId: 'g1', type: 'spend', amount: 30_000 }),
      tx({ goalId: null, type: 'spend', amount: 99_000 }),
    ]
    expect(contributionsByGoal(goals, txns, RATES)).toEqual({ g1: 80_000 })
  })
})
