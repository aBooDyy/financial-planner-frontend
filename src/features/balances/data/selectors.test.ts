import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import { buildBalancesView, walletGroupOptions } from './selectors'

let counter = 0
function node(over: Partial<LocalBalanceNode>): LocalBalanceNode {
  counter += 1
  return {
    id: over.id ?? `n${counter}`,
    kind: 'wallet',
    parentId: null,
    name: 'Node',
    color: '#1F9D6B',
    icon: null,
    note: null,
    position: 0,
    collapsed: false,
    amount: null,
    currency: null,
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  }
}

const rates = { SAR: 1, USD: 3.75 }

function sampleTree(collapsed = false): LocalBalanceNode[] {
  return [
    node({ id: 'g1', kind: 'group', name: 'Bank', position: 0, collapsed }),
    node({
      id: 'w1',
      parentId: 'g1',
      name: 'Checking',
      amount: 1000000, // 10,000.00 SAR
      currency: 'SAR',
      position: 0,
    }),
    node({
      id: 'w2',
      parentId: 'g1',
      name: 'Savings',
      amount: 500000, // 5,000.00 SAR
      currency: 'SAR',
      position: 1,
    }),
    node({
      id: 'w3',
      name: 'Wise',
      amount: 100000, // 1,000.00 USD → 3,750.00 SAR
      currency: 'USD',
      position: 1,
    }),
  ]
}

describe('buildBalancesView', () => {
  it('rolls up multi-currency totals into the base currency', () => {
    const view = buildBalancesView(sampleTree(), 'SAR', rates)
    expect(view.grandTotalStr).toBe('SR 18,750.00')
    expect(view.walletCount).toBe(3)
    expect(view.groupCount).toBe(1)
    expect(view.currencyCount).toBe(2)
  })

  it('flattens the visible tree and respects collapse', () => {
    expect(
      buildBalancesView(sampleTree(false), 'SAR', rates).rows,
    ).toHaveLength(4)
    // Collapsing the group hides its two children.
    const collapsed = buildBalancesView(sampleTree(true), 'SAR', rates)
    expect(collapsed.rows).toHaveLength(2)
    expect(collapsed.rows.map((r) => r.id)).toEqual(['g1', 'w3'])
  })

  it('keeps totals, counts and the breakdown independent of collapse', () => {
    const open = buildBalancesView(sampleTree(false), 'SAR', rates)
    const collapsed = buildBalancesView(sampleTree(true), 'SAR', rates)
    expect(collapsed.walletCount).toBe(open.walletCount)
    expect(collapsed.groupCount).toBe(open.groupCount)
    expect(collapsed.currencyCount).toBe(open.currencyCount)
    expect(collapsed.grandTotalStr).toBe(open.grandTotalStr)
    expect(collapsed.breakdown).toEqual(open.breakdown)
  })

  it('orders the currency breakdown by base value, largest first', () => {
    const view = buildBalancesView(sampleTree(), 'SAR', rates)
    expect(view.breakdown.map((b) => b.currency)).toEqual(['SAR', 'USD'])
    expect(view.breakdown[0].showBase).toBe(false)
    expect(view.breakdown[1].showBase).toBe(true)
  })

  it('carries a node icon through, defaulting by kind when unset or unknown', () => {
    const tree = sampleTree()
    tree[1].icon = 'piggy-bank' // the Checking wallet picked one
    tree[2].icon = 'not-an-icon' // an id this pack no longer defines
    const rows = buildBalancesView(tree, 'SAR', rates).rows
    const iconOf = (id: string) => rows.find((r) => r.id === id)!.icon
    expect(iconOf('w1')).toBe('piggy-bank')
    expect(iconOf('w2')).toBe('wallet')
    expect(iconOf('w3')).toBe('wallet')
    expect(iconOf('g1')).toBe('stack')
  })

  it('excludes soft-deleted nodes', () => {
    const tree = sampleTree()
    tree[3].deleted = 1 // drop the USD wallet
    const view = buildBalancesView(tree, 'SAR', rates)
    expect(view.walletCount).toBe(2)
    expect(view.grandTotalStr).toBe('SR 15,000.00')
  })
})

describe('buildBalancesView reservations', () => {
  it('splits a wallet into reserved vs available and lists the breakdown', () => {
    const reservations = {
      w1: [
        {
          goalId: 'car',
          goalName: 'New car',
          color: '#EC4899',
          amount: 300000,
        },
        { goalId: 'rent', goalName: 'Rent', color: '#3B82F6', amount: 150000 },
      ],
    }
    const view = buildBalancesView(sampleTree(), 'SAR', rates, {}, reservations)
    const w1 = view.rows.find((r) => r.id === 'w1')!
    expect(w1.reserved).toBe(450000)
    expect(w1.available).toBe(550000) // 10,000 − 4,500
    expect(w1.hasReserved).toBe(true)
    expect(w1.reservations.map((r) => r.goalName)).toEqual(['New car', 'Rent'])
    // Untouched wallets carry no reserve.
    expect(view.rows.find((r) => r.id === 'w2')!.hasReserved).toBe(false)
  })

  it('rolls reserved up to the group and the view total (base currency)', () => {
    const reservations = {
      w1: [
        { goalId: 'car', goalName: 'Car', color: '#EC4899', amount: 300000 },
      ],
      // 100.00 USD reserved against the USD wallet → 375.00 SAR in base.
      w3: [
        { goalId: 'trip', goalName: 'Trip', color: '#F59E0B', amount: 10000 },
      ],
    }
    const view = buildBalancesView(sampleTree(), 'SAR', rates, {}, reservations)
    expect(view.rows.find((r) => r.id === 'g1')!.reserved).toBe(300000)
    expect(view.reservedTotal).toBe(300000 + 37500)
    expect(view.hasReserved).toBe(true)
    expect(view.reservedTotalStr).toBe('SR 3,375.00')
  })

  it('allows over-reserving a wallet — available goes negative and is flagged', () => {
    const reservations = {
      // 6,000 reserved against a 5,000.00 balance.
      w2: [{ goalId: 'x', goalName: 'X', color: '#000', amount: 600000 }],
    }
    const view = buildBalancesView(sampleTree(), 'SAR', rates, {}, reservations)
    const w2 = view.rows.find((r) => r.id === 'w2')!
    expect(w2.reserved).toBe(600000) // not capped
    expect(w2.available).toBe(-100000)
    expect(w2.overReserved).toBe(true)
  })
})

describe('walletGroupOptions', () => {
  it('buckets wallets under their containing group, root wallets ungrouped', () => {
    const groups = walletGroupOptions(sampleTree())
    expect(groups).toEqual([
      { label: null, wallets: [{ id: 'w3', name: 'Wise' }] },
      {
        label: 'Bank',
        wallets: [
          { id: 'w1', name: 'Checking' },
          { id: 'w2', name: 'Savings' },
        ],
      },
    ])
  })

  it('flattens nested groups into a path label', () => {
    const tree = [
      node({ id: 'g1', kind: 'group', name: 'Banks', position: 0 }),
      node({
        id: 'g2',
        kind: 'group',
        name: 'Local',
        parentId: 'g1',
        position: 0,
      }),
      node({ id: 'w1', name: 'Riyad', parentId: 'g2', position: 0 }),
    ]
    expect(walletGroupOptions(tree)).toEqual([
      { label: 'Banks › Local', wallets: [{ id: 'w1', name: 'Riyad' }] },
    ])
  })

  it('skips groups with no direct wallet children and excludes deleted', () => {
    const tree = sampleTree()
    tree[1].deleted = 1 // remove Checking from the Bank group
    const groups = walletGroupOptions(tree)
    expect(groups).toEqual([
      { label: null, wallets: [{ id: 'w3', name: 'Wise' }] },
      { label: 'Bank', wallets: [{ id: 'w2', name: 'Savings' }] },
    ])
  })
})
