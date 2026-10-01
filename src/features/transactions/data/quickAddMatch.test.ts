import { describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { m, planned, RATES, wallet } from '#/features/planned/testing/fixtures'
import {
  DIALOG_MATCH,
  findAmountMatch,
  billIdForMatch,
  findQuickAddMatch,
  goalIdForMatch,
  plannedWalletOf,
  quickAddTarget,
} from './quickAddMatch'

const TODAY = '2026-09-24'

const payday = (over: Partial<LocalPlanned> = {}) =>
  planned({
    origin: 'income',
    role: 'income',
    goalId: null,
    incomeStreamId: 's1',
    name: 'Salary',
    amount: m(12000),
    occurrence: '2026-09-27',
    ...over,
  })

const netflix = (over: Partial<LocalPlanned> = {}) =>
  planned({
    origin: 'bill',
    role: 'payment',
    goalId: null,
    billId: 'r1',
    name: 'Netflix',
    amount: m(45),
    occurrence: '2026-09-23',
    ...over,
  })

const find = (
  items: LocalPlanned[],
  over: Partial<Parameters<typeof findQuickAddMatch>[0]> = {},
) =>
  findQuickAddMatch({
    type: 'income',
    amount: m(12000),
    currency: 'SAR',
    today: TODAY,
    planned: items,
    remainderOf: (p) => p.amount,
    rates: RATES,
    ...over,
  })?.id ?? null

describe('findQuickAddMatch', () => {
  it('matches a payday with the exact amount within three days', () => {
    const item = payday({ id: 'pay' })
    expect(find([item])).toBe('pay')
    expect(find([item], { amount: m(11999) })).toBeNull()
    expect(find([item], { today: '2026-09-30' })).toBe('pay')
    expect(find([item], { today: '2026-10-01' })).toBeNull()
    expect(find([item], { today: '2026-09-24' })).toBe('pay')
    expect(find([item], { today: '2026-09-23' })).toBeNull()
  })

  it('needs an amount', () => {
    expect(find([payday()], { amount: null })).toBeNull()
    expect(find([payday()], { amount: 0 })).toBeNull()
  })

  it('matches by type: income settles paydays, spend settles payments', () => {
    const items = [payday({ id: 'pay' }), netflix({ id: 'nf' })]
    expect(find(items, { type: 'spend', amount: m(12000) })).toBeNull()
    expect(find(items, { type: 'spend', amount: m(45) })).toBe('nf')
    expect(find(items, { type: 'income', amount: m(45) })).toBeNull()
  })

  it('takes paydays and bill payments, never set-asides or manual items', () => {
    const items = [
      planned({
        id: 'rent',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        amount: m(3500),
        occurrence: TODAY,
      }),
      planned({
        id: 'aside',
        role: 'set_aside',
        amount: m(3500),
        occurrence: TODAY,
      }),
      planned({
        id: 'manual',
        origin: 'manual',
        role: 'payment',
        amount: m(900),
        occurrence: TODAY,
      }),
      netflix({ id: 'bonus', role: 'income', amount: m(700) }),
    ]
    expect(find(items, { type: 'spend', amount: m(3500) })).toBe('rent')
    expect(find(items, { type: 'spend', amount: m(900) })).toBeNull()
    expect(find(items, { type: 'income', amount: m(700) })).toBe('bonus')
  })

  it('compares against what is still open, converted to the item’s currency', () => {
    const item = payday({ id: 'pay', amount: m(1000), currency: 'USD' })
    expect(find([item], { amount: m(3750) })).toBe('pay')
    expect(find([item], { amount: m(1500), remainderOf: () => m(400) })).toBe(
      'pay',
    )
    expect(find([item], { amount: m(3750), remainderOf: () => 0 })).toBeNull()
  })

  it('skips closed, skipped and deleted items', () => {
    expect(find([payday({ status: 'done' })])).toBeNull()
    expect(find([payday({ status: 'skipped' })])).toBeNull()
    expect(find([payday({ deleted: 1 })])).toBeNull()
  })

  it('picks the oldest of several', () => {
    const items = [
      payday({ id: 'late', occurrence: '2026-09-26' }),
      payday({ id: 'early', occurrence: '2026-09-22' }),
    ]
    expect(find(items)).toBe('early')
  })
})

describe('goalIdForMatch / billIdForMatch', () => {
  it('carries the goal or the bill a payment belongs to, on a spend only', () => {
    const goalPayment = planned({
      origin: 'manual',
      role: 'payment',
      goalId: 'car',
    })
    expect(goalIdForMatch(goalPayment, 'spend')).toBe('car')
    expect(billIdForMatch(goalPayment, 'spend')).toBeNull()
    expect(goalIdForMatch(netflix(), 'spend')).toBeNull()
    expect(billIdForMatch(netflix(), 'spend')).toBe('r1')
    expect(goalIdForMatch(payday(), 'income')).toBeNull()
    expect(billIdForMatch(payday(), 'income')).toBeNull()
  })
})

describe('plannedWalletOf', () => {
  it('is the live wallet the item names, else null', () => {
    const nodes = [
      wallet({ id: 'main' }),
      wallet({ id: 'gone', deleted: 1 }),
      wallet({ id: 'grp', kind: 'group' }),
    ]
    expect(plannedWalletOf(payday({ walletId: 'main' }), nodes)?.id).toBe(
      'main',
    )
    expect(plannedWalletOf(payday({ walletId: 'gone' }), nodes)).toBeNull()
    expect(plannedWalletOf(payday({ walletId: 'grp' }), nodes)).toBeNull()
    expect(plannedWalletOf(payday({ walletId: null }), nodes)).toBeNull()
  })
})

describe('quickAddTarget', () => {
  const base = { amount: m(3750), currency: 'SAR', rates: RATES }

  it('writes a linked entry to the planned wallet, in its currency', () => {
    expect(
      quickAddTarget({
        ...base,
        walletId: 'savings',
        plannedWallet: { id: 'main', currency: 'SAR' },
      }),
    ).toEqual({ walletId: 'main', amount: m(3750), currency: 'SAR' })
    expect(
      quickAddTarget({
        ...base,
        walletId: 'savings',
        plannedWallet: { id: 'usd', currency: 'USD' },
      }),
    ).toEqual({ walletId: 'usd', amount: m(1000), currency: 'USD' })
  })

  it('falls back to QuickAdd’s own account', () => {
    expect(
      quickAddTarget({ ...base, walletId: 'savings', plannedWallet: null }),
    ).toEqual({ walletId: 'savings', amount: m(3750), currency: 'SAR' })
    expect(
      quickAddTarget({ ...base, walletId: null, plannedWallet: null }),
    ).toBeNull()
  })
})

describe('findAmountMatch', () => {
  const findLoose = (
    items: LocalPlanned[],
    over: Partial<Parameters<typeof findAmountMatch>[0]> = {},
  ) =>
    findAmountMatch({
      type: 'spend',
      amount: m(4500),
      currency: 'SAR',
      date: '2026-09-28',
      planned: items,
      remainderOf: (p) => p.amount,
      rates: RATES,
      withinDays: DIALOG_MATCH.days,
      tolerance: DIALOG_MATCH.tolerance,
      ...over,
    })?.id ?? null
  const rent = planned({
    id: 'rent',
    role: 'payment',
    origin: 'bill',
    goalId: null,
    billId: 'rent',
    amount: m(4500),
    occurrence: '2026-09-30',
  })

  it('takes an amount within 10% of the open remainder', () => {
    expect(findLoose([rent])).toBe('rent')
    expect(findLoose([rent], { amount: m(4050) })).toBe('rent')
    expect(findLoose([rent], { amount: m(4950) })).toBe('rent')
    expect(findLoose([rent], { amount: m(4049) })).toBeNull()
    expect(findLoose([rent], { amount: m(4951) })).toBeNull()
  })

  it('takes an item dated within a week of the entry', () => {
    expect(findLoose([rent], { date: '2026-10-07' })).toBe('rent')
    expect(findLoose([rent], { date: '2026-10-08' })).toBeNull()
    expect(findLoose([rent], { date: '2026-09-23' })).toBe('rent')
    expect(findLoose([rent], { date: '2026-09-22' })).toBeNull()
  })
})
