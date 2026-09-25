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
  date: '2026-06-12',
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

  it('debits the source and credits the destination of a transfer', () => {
    const nodes = [
      wallet({ id: 'w1', amount: 100_000 }),
      wallet({ id: 'w2', amount: 0 }),
    ]
    const leg = { category: null, transferId: 'tr1', amount: 40_000 }
    const txns = [
      tx({ ...leg, walletId: 'w1', type: 'transfer_out' }),
      tx({ ...leg, walletId: 'w2', type: 'transfer_in' }),
    ]
    expect(walletLiveBalances(nodes, txns, RATES)).toEqual({
      w1: 60_000,
      w2: 40_000,
    })
  })

  it('moves each leg of a cross-currency transfer in its own wallet currency', () => {
    const nodes = [
      wallet({ id: 'w1', amount: 375_000, currency: 'SAR' }),
      wallet({ id: 'w2', amount: 0, currency: 'USD' }),
    ]
    const txns = [
      tx({
        walletId: 'w1',
        type: 'transfer_out',
        category: null,
        transferId: 'tr1',
        amount: 375_000,
        currency: 'SAR',
      }),
      tx({
        walletId: 'w2',
        type: 'transfer_in',
        category: null,
        transferId: 'tr1',
        amount: 99_000,
        currency: 'USD',
      }),
    ]
    expect(walletLiveBalances(nodes, txns, RATES)).toEqual({
      w1: 0,
      w2: 99_000,
    })
  })

  it('credits an upward adjustment and debits a downward one', () => {
    const nodes = [
      wallet({ id: 'w1', amount: 100_000 }),
      wallet({ id: 'w2', amount: 100_000 }),
    ]
    const adjustment = { category: null, amount: 12_500 }
    const txns = [
      tx({ ...adjustment, walletId: 'w1', type: 'adjustment_in' }),
      tx({ ...adjustment, walletId: 'w2', type: 'adjustment_out' }),
    ]
    expect(walletLiveBalances(nodes, txns, RATES)).toEqual({
      w1: 112_500,
      w2: 87_500,
    })
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
