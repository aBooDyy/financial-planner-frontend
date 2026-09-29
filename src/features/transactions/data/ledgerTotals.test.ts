import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode, LocalTransaction } from '#/db/types'
import { walletDeltas } from './ledger'
import {
  applyTotalsDiff,
  contributionsOf,
  countsFromTotals,
  sameTotals,
  totalsDiff,
  totalsOf,
  walletDeltasFromTotals,
} from './ledgerTotals'

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
  categoryId: 'cat-food',
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

const byId = (totals: ReturnType<typeof totalsOf>) =>
  Object.fromEntries(totals.map((t) => [t.id, { sum: t.sum, count: t.count }]))

describe('contributionsOf', () => {
  it('counts a live row toward its wallet, category, merchant and currency', () => {
    const row = tx({ amount: 500, merchantId: 'm1' })
    expect(byId(contributionsOf(row))).toEqual({
      'currency:SAR': { sum: 0, count: 1 },
      'wallet:w1:SAR': { sum: -500, count: 1 },
      'category:cat-food': { sum: 0, count: 1 },
      'merchant:m1': { sum: 0, count: 1 },
    })
  })

  it('signs credits positive', () => {
    for (const type of ['income', 'transfer_in', 'adjustment_in'] as const) {
      const [, walletTotal] = contributionsOf(tx({ type, amount: 70 }))
      expect(walletTotal.sum).toBe(70)
    }
  })

  it('keeps only the currency of a deleted row', () => {
    expect(byId(contributionsOf(tx({ amount: 500, deleted: 1 })))).toEqual({
      'currency:SAR': { sum: 0, count: 1 },
    })
  })

  it('skips the category and merchant a row does not have', () => {
    const ids = contributionsOf(
      tx({ type: 'transfer_out', categoryId: null }),
    ).map((t) => t.id)
    expect(ids).toEqual(['currency:SAR', 'wallet:w1:SAR'])
  })
})

describe('totalsOf', () => {
  it('keeps a wallet’s rows apart by currency', () => {
    const totals = totalsOf([
      tx({ amount: 100 }),
      tx({ amount: 40, type: 'income' }),
      tx({ amount: 10, currency: 'USD' }),
    ])
    expect(byId(totals.filter((t) => t.kind === 'wallet'))).toEqual({
      'wallet:w1:SAR': { sum: -60, count: 2 },
      'wallet:w1:USD': { sum: -10, count: 1 },
    })
  })
})

describe('totalsDiff', () => {
  it('moves a row between wallets as one take and one give', () => {
    const before = tx({ id: 'a', amount: 300 })
    const after = { ...before, walletId: 'w2' }
    expect(byId(totalsDiff([before], [after]))).toEqual({
      'wallet:w1:SAR': { sum: 300, count: -1 },
      'wallet:w2:SAR': { sum: -300, count: 1 },
    })
  })

  it('is empty when an edit touches nothing the totals hold', () => {
    const before = tx({ id: 'a', amount: 300 })
    expect(
      totalsDiff([before], [{ ...before, note: 'lunch', dirty: 1 }]),
    ).toEqual([])
  })

  it('takes a soft-deleted row out of everything but its currency', () => {
    const before = tx({ id: 'a', amount: 300 })
    expect(byId(totalsDiff([before], [{ ...before, deleted: 1 }]))).toEqual({
      'wallet:w1:SAR': { sum: 300, count: -1 },
      'category:cat-food': { sum: 0, count: -1 },
    })
  })
})

describe('applyTotalsDiff', () => {
  it('adds onto stored totals, creates missing ones and removes emptied ones', () => {
    const stored = totalsOf([tx({ amount: 100 })])
    const food = stored.find((t) => t.id === 'category:cat-food')!
    const walletTotal = stored.find((t) => t.id === 'wallet:w1:SAR')!
    const diff = totalsDiff(
      [tx({ amount: 100 })],
      [tx({ amount: 250, categoryId: 'cat-fuel' })],
    )
    const storedFor = diff.map((d) =>
      d.id === food.id
        ? food
        : d.id === walletTotal.id
          ? walletTotal
          : undefined,
    )

    const { put, remove } = applyTotalsDiff(storedFor, diff)

    expect(remove).toEqual(['category:cat-food'])
    expect(byId(put)).toEqual({
      'wallet:w1:SAR': { sum: -250, count: 1 },
      'category:cat-fuel': { sum: 0, count: 1 },
    })
  })
})

describe('sameTotals', () => {
  it('ignores order and notices any differing figure', () => {
    const a = totalsOf([tx({ amount: 1 }), tx({ amount: 2, merchantId: 'm' })])
    expect(sameTotals(a, [...a].reverse())).toBe(true)
    expect(sameTotals(a, a.slice(1))).toBe(false)
    expect(
      sameTotals(
        a,
        a.map((t) => (t.kind === 'wallet' ? { ...t, sum: t.sum + 1 } : t)),
      ),
    ).toBe(false)
  })
})

describe('walletDeltasFromTotals', () => {
  it('equals the per-row sum exactly when a wallet’s rows share its currency', () => {
    const w = wallet({ id: 'w1' })
    const rows = [
      tx({ amount: 1234 }),
      tx({ amount: 99, type: 'income' }),
      tx({ amount: 5000, deleted: 1 }),
    ]
    expect(walletDeltasFromTotals([w], totalsOf(rows), RATES)).toEqual(
      walletDeltas([w], rows, RATES),
    )
  })

  it('converts each currency’s sum into the wallet’s currency on read', () => {
    const w = wallet({ id: 'w1', currency: 'SAR' })
    const rows = [tx({ amount: 1000 }), tx({ amount: 1000, currency: 'USD' })]
    expect(walletDeltasFromTotals([w], totalsOf(rows), RATES)).toEqual({
      w1: -1000 - 3750,
    })
    expect(
      walletDeltasFromTotals([w], totalsOf(rows), { SAR: 1, USD: 4 }),
    ).toEqual({ w1: -1000 - 4000 })
  })

  it('leaves out rows on wallets that are gone', () => {
    const w = wallet({ id: 'w1', deleted: 1 })
    expect(
      walletDeltasFromTotals([w], totalsOf([tx({ amount: 5 })]), RATES),
    ).toEqual({})
  })
})

describe('countsFromTotals', () => {
  it('maps each id to its live row count', () => {
    const totals = totalsOf([
      tx({ merchantId: 'm1' }),
      tx({ merchantId: 'm1' }),
      tx({ merchantId: 'm1', deleted: 1 }),
    ]).filter((t) => t.kind === 'merchant')
    expect(countsFromTotals(totals)).toEqual(new Map([['m1', 2]]))
  })
})
