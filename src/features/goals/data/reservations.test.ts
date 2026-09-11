import { describe, expect, it } from 'vitest'
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalGoalAllocation,
} from '#/db/types'
import { allocationsByGoal, walletReservations } from './reservations'

const RATES: Partial<Record<string, number>> = { SAR: 1, USD: 3.75 }

let seq = 0
const goal = (over: Partial<LocalGoal>): LocalGoal => ({
  id: `g${seq++}`,
  name: 'Goal',
  kind: 'onetime',
  currency: 'SAR',
  color: '#EC4899',
  position: seq,
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

const alloc = (over: Partial<LocalGoalAllocation>): LocalGoalAllocation => ({
  id: `a${seq++}`,
  goalId: 'g',
  source: 'wallet',
  walletId: null,
  externalLabel: null,
  amount: 0,
  currency: 'SAR',
  note: null,
  position: 0,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

describe('allocationsByGoal', () => {
  it('sums allocations per goal in the goal currency, converting FX', () => {
    const g = goal({ id: 'car', currency: 'SAR' })
    const allocations = [
      alloc({ goalId: 'car', amount: 100000, currency: 'SAR' }),
      // 100.00 USD → 375.00 SAR
      alloc({
        goalId: 'car',
        source: 'external',
        externalLabel: 'Gift',
        amount: 10000,
        currency: 'USD',
      }),
    ]
    const out = allocationsByGoal(allocations, [g], RATES)
    expect(out.car).toBe(100000 + 37500)
  })

  it('ignores soft-deleted allocations and unknown goals', () => {
    const g = goal({ id: 'car' })
    const allocations = [
      alloc({ goalId: 'car', amount: 5000, deleted: 1 }),
      alloc({ goalId: 'ghost', amount: 9999 }),
    ]
    expect(allocationsByGoal(allocations, [g], RATES)).toEqual({})
  })
})

describe('walletReservations', () => {
  it('groups wallet-sourced reserves per wallet in the wallet currency, largest first', () => {
    const g1 = goal({ id: 'car', name: 'New car', color: '#EC4899' })
    const g2 = goal({ id: 'rent', name: 'Rent', color: '#3B82F6' })
    const w = wallet({ id: 'main', currency: 'SAR' })
    const allocations = [
      alloc({
        goalId: 'car',
        walletId: 'main',
        amount: 300000,
        currency: 'SAR',
      }),
      alloc({
        goalId: 'rent',
        walletId: 'main',
        amount: 150000,
        currency: 'SAR',
      }),
    ]
    const out = walletReservations(allocations, [g1, g2], [w], RATES)
    expect(out.main.map((l) => [l.goalName, l.amount])).toEqual([
      ['New car', 300000],
      ['Rent', 150000],
    ])
  })

  it('excludes external reserves and reserves whose wallet was deleted', () => {
    const g = goal({ id: 'car' })
    const allocations = [
      alloc({
        goalId: 'car',
        source: 'external',
        externalLabel: 'Dad',
        amount: 100000,
      }),
      alloc({ goalId: 'car', walletId: 'gone', amount: 200000 }),
    ]
    // No live wallet 'gone' in the node list, and the external reserve has no wallet.
    expect(walletReservations(allocations, [g], [], RATES)).toEqual({})
  })

  it('converts a reserve into the wallet currency', () => {
    const g = goal({ id: 'car' })
    const w = wallet({ id: 'usd', currency: 'USD' })
    // 375.00 SAR reserved against a USD wallet → 100.00 USD.
    const allocations = [
      alloc({ goalId: 'car', walletId: 'usd', amount: 37500, currency: 'SAR' }),
    ]
    expect(walletReservations(allocations, [g], [w], RATES).usd[0].amount).toBe(
      10000,
    )
  })
})
