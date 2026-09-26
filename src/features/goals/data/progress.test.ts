import { describe, expect, it } from 'vitest'
import {
  RATES,
  allocation,
  goal,
  m,
  planned,
  tx,
  wallet,
} from '#/features/planned/testing/fixtures'
import { goalProgress } from './progress'
import { walletReservations } from './reservations'

/**
 * The set-aside rule (ADR-3 = reserve): paying for a goal consumes what was set aside for it.
 * progress = max(reserved, spent); still reserved = max(0, reserved − spent).
 */

const TODAY = new Date(2026, 8, 24)
const umrah = goal({ id: 'umrah', kind: 'onetime', target: m(13000) })
const main = wallet({ id: 'main', name: 'Main Checking' })
const savings = wallet({ id: 'savings', name: 'Savings' })
const card = wallet({ id: 'card', name: 'Card' })

const setAside = (amount: number, walletId = 'main', date = '2026-08-01') =>
  allocation({ goalId: 'umrah', walletId, amount, date })
const pay = (amount: number, walletId = 'card', date = '2026-09-20') =>
  tx({ goalId: 'umrah', walletId, amount, date, type: 'spend' })

describe('goalProgress — the three cases', () => {
  it('saved then paid in full: progress is the target and nothing stays reserved', () => {
    const p = goalProgress(
      [umrah],
      [setAside(m(13000))],
      [pay(m(13000))],
      RATES,
      TODAY,
    ).umrah!
    expect(p.progress).toBe(m(13000))
    expect(p.stillReserved).toBe(0)
    expect(p.byWallet).toEqual({})
  })

  it('paid directly with nothing set aside: progress is the payment, nothing reserved', () => {
    const p = goalProgress([umrah], [], [pay(m(3500))], RATES, TODAY).umrah!
    expect(p.progress).toBe(m(3500))
    expect(p.stillReserved).toBe(0)
  })

  it('saved 5,000 and paid a 1,000 deposit: progress 5,000, 4,000 still reserved', () => {
    const p = goalProgress(
      [umrah],
      [setAside(m(5000))],
      [pay(m(1000), 'main')],
      RATES,
      TODAY,
    ).umrah!
    expect(p.progress).toBe(m(5000))
    expect(p.stillReserved).toBe(m(4000))
    expect(p.byWallet).toEqual({ main: m(4000) })
  })

  it('is the max of the two, never their sum', () => {
    const p = goalProgress(
      [umrah],
      [setAside(m(4000))],
      [pay(m(3000))],
      RATES,
      TODAY,
    ).umrah!
    expect(p.progress).toBe(m(4000))
  })

  it('ignores income, transfers and other goals', () => {
    const p = goalProgress(
      [umrah],
      [allocation({ goalId: 'car', amount: m(900) })],
      [
        tx({ goalId: 'umrah', type: 'income', amount: m(500) }),
        tx({ goalId: 'car', amount: m(700) }),
      ],
      RATES,
      TODAY,
    ).umrah!
    expect(p.progress).toBe(0)
  })
})

describe('goalProgress — which wallet a payment releases', () => {
  it('releases the paying wallet’s reservation first', () => {
    const p = goalProgress(
      [umrah],
      [setAside(m(3000), 'main'), setAside(m(5000), 'savings')],
      [pay(m(2000), 'main')],
      RATES,
      TODAY,
    ).umrah!
    expect(p.byWallet).toEqual({ main: m(1000), savings: m(5000) })
  })

  it('then the others, largest reservation first', () => {
    const p = goalProgress(
      [umrah],
      [
        setAside(m(1000), 'main'),
        setAside(m(5000), 'savings'),
        allocation({
          goalId: 'umrah',
          source: 'external',
          walletId: null,
          externalLabel: 'Dad',
          amount: m(3000),
        }),
      ],
      [pay(m(4000), 'card')],
      RATES,
      TODAY,
    ).umrah!
    // 4,000 from the card: Savings (5,000) is the largest → 1,000 left there.
    expect(p.byWallet).toEqual({ main: m(1000), savings: m(1000) })
    expect(p.external).toBe(m(3000))
    expect(p.stillReserved).toBe(m(5000))
  })
})

describe('goalProgress — recurring obligations work per cycle', () => {
  const insurance = goal({
    id: 'ins',
    kind: 'recurring',
    amount: m(3000),
    frequency: 'quarterly',
    nextDue: '2026-10-01',
  })
  const reserve = (
    amount: number,
    date: string,
    plannedId: string | null = null,
  ) => allocation({ goalId: 'ins', walletId: 'main', amount, date, plannedId })
  const payIns = (
    amount: number,
    date: string,
    plannedId: string | null = null,
  ) => tx({ goalId: 'ins', walletId: 'main', amount, date, plannedId })

  it('counts this cycle’s set-asides as progress, not last year’s', () => {
    const p = goalProgress(
      [insurance],
      [
        reserve(m(1000), '2026-07-01'),
        reserve(m(1000), '2026-08-01'),
        reserve(m(1000), '2026-09-01'),
      ],
      [payIns(m(3000), '2026-07-01')], // paid the Jul 1 cycle
      RATES,
      TODAY,
    ).ins!
    // The Jul–Sep set-asides fund the Oct 1 due; July’s payment paid the July cycle.
    expect(p.reserved).toBe(m(3000))
    expect(p.spent).toBe(0)
    expect(p.progress).toBe(m(3000))
    expect(p.stillReserved).toBe(m(3000))
  })

  it('does not let last cycle’s payment consume this cycle’s reservations', () => {
    const p = goalProgress(
      [insurance],
      [reserve(m(1000), '2026-08-01')],
      [payIns(m(3000), '2026-06-20')],
      RATES,
      TODAY,
    ).ins!
    expect(p.stillReserved).toBe(m(1000))
  })

  it('files a late payment under the cycle its planned row was due in', () => {
    const rows = [
      planned({
        id: 'oct-pay',
        goalId: 'ins',
        role: 'payment',
        occurrence: '2026-10-01',
      }),
    ]
    const later = new Date(2026, 9, 3)
    const p = goalProgress(
      [insurance],
      [reserve(m(3000), '2026-09-01')],
      [payIns(m(3000), '2026-10-03', 'oct-pay')],
      RATES,
      later,
      rows,
    ).ins!
    // Paid three days late, still pays the Oct 1 cycle and consumes its reservation.
    expect(p.stillReserved).toBe(0)
  })
})

describe('walletReservations — Wallets after a goal payment', () => {
  it('shows only what is still reserved, per goal, in the wallet currency', () => {
    const allocations = [
      setAside(m(5000), 'main'),
      setAside(m(2000), 'savings'),
    ]
    const before = walletReservations(
      allocations,
      [umrah],
      [main, savings, card],
      RATES,
    )
    expect(before.main[0].amount).toBe(m(5000))

    const after = walletReservations(
      allocations,
      [umrah],
      [main, savings, card],
      RATES,
      [pay(m(6000), 'main')],
      TODAY,
    )
    // 6,000 from Main: its 5,000 first, then 1,000 of Savings’ 2,000.
    expect(after.main).toBeUndefined()
    expect(after.savings.map((l) => [l.goalId, l.amount])).toEqual([
      ['umrah', m(1000)],
    ])
  })

  it('keeps an unconsumed pot exact in a foreign-currency wallet', () => {
    const usd = wallet({ id: 'usd', currency: 'USD' })
    const out = walletReservations(
      [
        allocation({
          goalId: 'umrah',
          walletId: 'usd',
          amount: m(100),
          currency: 'USD',
        }),
      ],
      [umrah],
      [usd],
      RATES,
    )
    expect(out.usd[0].amount).toBe(m(100))
  })
})
