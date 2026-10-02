import { describe, expect, it } from 'vitest'
import type { LocalPlanned, LocalSetAside, LocalTransaction } from '#/db/types'
import { buildPlannedList } from '#/features/planned/data/views'
import { indexSettlements } from '#/features/planned/data/settle'
import {
  RATES,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { buildComingUp } from './comingUp'
import { transferWallets } from './transferDialog'

const TODAY = '2026-09-27'

const checking = wallet({ id: 'w1', name: 'Checking', amount: m(2000) })
const dollars = wallet({
  id: 'w2',
  name: 'Dollars',
  currency: 'USD',
  amount: m(1000),
  position: 1,
})

const bill = (over: Partial<LocalPlanned>) =>
  planned({
    origin: 'bill',
    role: 'payment',
    goalId: null,
    walletId: 'w1',
    name: 'Rent',
    ...over,
  })

const payday = (over: Partial<LocalPlanned>) =>
  planned({
    origin: 'income',
    role: 'income',
    goalId: null,
    walletId: 'w1',
    name: 'Salary',
    ...over,
  })

function view(
  rows: LocalPlanned[],
  setAsides: LocalSetAside[] = [],
  txns: LocalTransaction[] = [],
) {
  const held: Record<string, number> = {}
  for (const a of setAsides)
    if (a.walletId) held[a.walletId] = (held[a.walletId] ?? 0) + a.amount
  const nodes = [checking, dollars]
  const list = buildPlannedList({
    planned: rows,
    nodes,
    index: indexSettlements(txns, []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })
  return buildComingUp({
    rows: [...list.due, ...list.next, ...list.later],
    wallets: transferWallets(nodes, {}, 'SAR'),
    setAside: held,
    setAsides,
    base: 'SAR',
    rates: RATES,
    today: TODAY,
  })
}

describe('buildComingUp', () => {
  it('walks a wallet from today to where it ends up after 30 days', () => {
    const v = view([
      bill({ occurrence: '2026-10-01', amount: m(1500) }),
      payday({ occurrence: '2026-10-05', amount: m(3000) }),
    ])
    expect(v.wallets).toHaveLength(1)
    const w = v.wallets[0]
    expect(w.name).toBe('Checking')
    expect(w.nowStr).toBe('SR 2,000.00')
    expect(w.afterStr).toBe('SR 3,500.00')
    expect(w.items.map((i) => i.amountStr)).toEqual([
      '−SR 1,500.00',
      '+SR 3,000.00',
    ])
    expect(w.alert).toBeNull()
  })

  it('leaves out anything past 30 days, set-asides and closed rows', () => {
    const v = view([
      bill({ occurrence: '2026-10-28' }),
      planned({ walletId: 'w1', occurrence: '2026-10-01' }),
      bill({ occurrence: '2026-10-02', status: 'done' }),
    ])
    expect(v.isEmpty).toBe(true)
  })

  it('counts an overdue bill as landing now, and flags the shortfall', () => {
    const v = view([bill({ occurrence: '2026-09-20', amount: m(2500) })])
    expect(v.wallets[0].items[0].whenStr).toBe('7 days late')
    expect(v.wallets[0].alert).toEqual({
      kind: 'short',
      text: 'Goes below zero now',
    })
  })

  it('names the day a wallet first drops below zero, even if income refills it', () => {
    const v = view([
      bill({ occurrence: '2026-10-01', amount: m(2500) }),
      payday({ occurrence: '2026-10-05', amount: m(3000) }),
    ])
    expect(v.wallets[0].alert?.text).toBe('Goes below zero on Oct 1')
    expect(v.wallets[0].afterStr).toBe('SR 2,500.00')
  })

  it('walks Free to spend, not the balance', () => {
    const v = view(
      [payday({ occurrence: '2026-10-05', amount: m(500) })],
      [setAside({ walletId: 'w1', amount: m(1200) })],
    )
    expect(v.wallets[0].nowStr).toBe('SR 800.00')
    expect(v.wallets[0].afterStr).toBe('SR 1,300.00')
  })

  it('warns when a payment eats into money set aside for something else', () => {
    const v = view(
      [bill({ billId: 'rent', occurrence: '2026-10-01', amount: m(1500) })],
      [setAside({ walletId: 'w1', goalId: 'trip', amount: m(1000) })],
    )
    expect(v.wallets[0].alert).toEqual({
      kind: 'setAside',
      text: 'Dips into set-aside money on Oct 1',
    })
  })

  it('lets a payment release its own set-aside without crying wolf (F8)', () => {
    const v = view(
      [bill({ billId: 'rent', occurrence: '2026-10-01', amount: m(1500) })],
      [
        setAside({
          walletId: 'w1',
          goalId: null,
          billId: 'rent',
          occurrence: '2026-10-01',
          amount: m(1500),
        }),
      ],
    )
    const w = v.wallets[0]
    expect(w.alert).toBeNull()
    // Free was 500; the payment is covered by what it had set aside, so Free stays 500.
    expect(w.nowStr).toBe('SR 500.00')
    expect(w.afterStr).toBe('SR 500.00')
  })

  it('does not blame a covered payment for a wallet already over-committed', () => {
    const v = view(
      [bill({ billId: 'gym', occurrence: '2026-10-01', amount: m(150) })],
      [
        setAside({
          walletId: 'w1',
          goalId: null,
          billId: 'gym',
          occurrence: '2026-10-01',
          amount: m(2100),
        }),
      ],
    )
    expect(v.wallets[0].nowStr).toBe('SR -100.00')
    expect(v.wallets[0].alert).toBeNull()
  })

  it('releases only what is held in the paying wallet, for that occurrence', () => {
    const v = view(
      [bill({ billId: 'rent', occurrence: '2026-10-01', amount: m(1500) })],
      [
        setAside({
          walletId: 'w2',
          goalId: null,
          billId: 'rent',
          occurrence: '2026-10-01',
          amount: m(100),
        }),
        setAside({
          walletId: 'w1',
          goalId: null,
          billId: 'rent',
          occurrence: '2026-11-01',
          amount: m(1000),
        }),
      ],
    )
    const checkingRow = v.wallets.find((w) => w.name === 'Checking')
    expect(checkingRow?.alert?.kind).toBe('setAside')
  })

  it('prices a bill in another currency in the wallet currency', () => {
    const v = view([
      bill({
        walletId: 'w2',
        currency: 'SAR',
        amount: m(375),
        occurrence: '2026-10-01',
      }),
    ])
    expect(v.wallets[0].afterStr).toBe('$900.00')
    expect(v.wallets[0].items[0].amountStr).toBe('−SR 375.00')
  })

  it('lifts wallets in trouble to the top and caps the list at three items', () => {
    const v = view([
      bill({ occurrence: '2026-09-28', amount: m(10) }),
      bill({ occurrence: '2026-09-29', amount: m(10) }),
      bill({ occurrence: '2026-09-30', amount: m(10) }),
      bill({ occurrence: '2026-10-01', amount: m(10) }),
      bill({ walletId: 'w2', occurrence: '2026-10-03', amount: m(99_999) }),
    ])
    expect(v.wallets.map((w) => w.name)).toEqual(['Dollars', 'Checking'])
    expect(v.wallets[1].items).toHaveLength(3)
    expect(v.wallets[1].moreCount).toBe(1)
  })

  it('counts rows with no known wallet instead of pricing them', () => {
    const v = view([
      bill({ walletId: null, occurrence: '2026-10-01' }),
      bill({ walletId: 'gone', occurrence: '2026-10-01' }),
    ])
    expect(v.wallets).toHaveLength(0)
    expect(v.unassignedCount).toBe(2)
    expect(v.unassignedStr).toBe('No wallet yet: −SR 3,000.00')
    expect(v.isEmpty).toBe(false)
  })
})
