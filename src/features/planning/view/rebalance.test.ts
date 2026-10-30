import { describe, expect, it } from 'vitest'
import { bill, goal, m, setAside } from '#/features/planned/testing/fixtures'
import { convertMinor } from '#/lib/currency'
import type { LocalSetAside } from '#/db/types'
import { suggestRebalance } from './rebalance'
import type { RebalanceMove } from './rebalance'

const RATES = { SAR: 1, USD: 3.75, KWD: 12.2, JPY: 0.025 }
const bills = [bill({ id: 'rent', name: 'Rent' })]
const goals = [goal({ id: 'umrah', name: 'Umrah' })]

const row = (over: Partial<LocalSetAside>) =>
  setAside({ goalId: null, billId: 'rent', walletId: 'over', ...over })
const billRow = (id: string, occurrence: string, amount: number) =>
  row({ id, occurrence, amount: m(amount) })
const goalRow = (id: string, amount: number, date = '2026-09-01') =>
  row({ id, goalId: 'umrah', billId: null, amount: m(amount), date })

const over = (by: number, currency = 'SAR') => ({
  walletId: 'over',
  free: -by,
  currency,
})
const room = (walletId: string, free: number, currency = 'SAR') => ({
  walletId,
  free,
  currency,
})

const suggest = (
  wallets: Parameters<typeof suggestRebalance>[0]['wallets'],
  setAsides: ReadonlyArray<LocalSetAside>,
) =>
  suggestRebalance({
    walletId: 'over',
    wallets,
    setAsides,
    bills,
    goals,
    rates: RATES,
  })

const shape = (moves: ReadonlyArray<RebalanceMove>) =>
  moves.map((mv) => [mv.setAsideId, mv.toWalletId, mv.amount])

describe('suggestRebalance', () => {
  it('has nothing to do for a wallet that is not over, or is not there', () => {
    const rows = [billRow('a', '2026-11-01', 100)]
    expect(suggest([room('over', m(5)), room('b', m(50))], rows)).toEqual({
      walletId: 'over',
      over: 0,
      moves: [],
      shortBy: 0,
    })
    expect(suggest([room('b', m(50))], rows).over).toBe(0)
  })

  it('moves goals first, then bills by the latest occurrence', () => {
    const plan = suggest(
      [over(m(600)), room('b', m(1000))],
      [
        billRow('near', '2026-11-01', 100),
        billRow('far', '2027-03-01', 100),
        goalRow('newer', 100, '2026-09-05'),
        goalRow('older', 100, '2026-09-01'),
        billRow('mid', '2026-12-01', 100),
      ],
    )
    expect(plan.moves.map((mv) => mv.setAsideId)).toEqual([
      'older',
      'newer',
      'far',
      'mid',
      'near',
    ])
    expect(plan.moves[0]).toMatchObject({
      ownerKind: 'goal',
      ownerName: 'Umrah',
      occurrence: null,
      currency: 'SAR',
    })
    expect(plan.moves[2]).toMatchObject({
      ownerKind: 'bill',
      ownerName: 'Rent',
      occurrence: '2027-03-01',
    })
    expect(plan.shortBy).toBe(m(100))
  })

  it('stays stable on createdAt when dates tie', () => {
    const plan = suggest(
      [over(m(200)), room('b', m(1000))],
      [
        row({
          id: 'second',
          occurrence: '2026-11-01',
          createdAt: '2026-09-02T00:00:00Z',
        }),
        row({
          id: 'first',
          occurrence: '2026-11-01',
          createdAt: '2026-09-01T00:00:00Z',
        }),
      ],
    )
    expect(plan.moves.map((mv) => mv.setAsideId)).toEqual(['first', 'second'])
  })

  it('splits a row when only part is needed, and stops once covered', () => {
    const plan = suggest(
      [over(m(30)), room('b', m(500))],
      [billRow('far', '2027-01-01', 100), billRow('near', '2026-11-01', 100)],
    )
    expect(shape(plan.moves)).toEqual([['far', 'b', m(30)]])
    expect(plan).toMatchObject({ over: m(30), shortBy: 0 })
  })

  it('fills the wallet with the most free first, comparing in one currency', () => {
    const plan = suggest(
      // 100 USD is 375 SAR: more than the 300 SAR, though the number is smaller.
      [over(m(100)), room('sar', m(300)), room('usd', m(100), 'USD')],
      [billRow('a', '2026-11-01', 100)],
    )
    expect(plan.moves.map((mv) => mv.toWalletId)).toEqual(['usd'])
  })

  it('splits one row across wallets, never past what a target has free', () => {
    const plan = suggest(
      [over(m(100)), room('big', m(60)), room('small', m(40))],
      [billRow('a', '2026-11-01', 100)],
    )
    expect(shape(plan.moves)).toEqual([
      ['a', 'big', m(60)],
      ['a', 'small', m(40)],
    ])
    expect(plan.shortBy).toBe(0)
  })

  it('reports what no wallet has room for', () => {
    const plan = suggest(
      [over(m(100)), room('b', m(30))],
      [billRow('a', '2026-11-01', 100)],
    )
    expect(shape(plan.moves)).toEqual([['a', 'b', m(30)]])
    expect(plan.shortBy).toBe(m(70))
  })

  it('reports all of it when the set-asides are less than the overage', () => {
    const plan = suggest(
      [over(m(100)), room('b', m(500))],
      [billRow('a', '2026-11-01', 40)],
    )
    expect(plan.shortBy).toBe(m(60))
  })

  it('never targets the source, or a wallet with nothing free', () => {
    const plan = suggest(
      [over(m(50)), room('zero', 0), room('negative', -m(5))],
      [billRow('a', '2026-11-01', 100)],
    )
    expect(plan.moves).toEqual([])
    expect(plan.shortBy).toBe(m(50))
  })

  it('reads only live wallet rows in this wallet, of an owner it knows', () => {
    const plan = suggest(
      [over(m(50)), room('b', m(500))],
      [
        billRow('kept', '2026-11-01', 100),
        row({
          id: 'freed',
          releasedAt: '2026-10-01',
          occurrence: '2027-01-01',
        }),
        row({ id: 'gone', deleted: 1, occurrence: '2027-01-01' }),
        row({ id: 'elsewhere', walletId: 'b', occurrence: '2027-01-01' }),
        row({
          id: 'outside',
          source: 'outside',
          walletId: null,
          externalLabel: 'Cash',
          occurrence: '2027-01-01',
        }),
        row({ id: 'unknown', billId: 'gone-bill', occurrence: '2027-01-01' }),
      ],
    )
    expect(plan.moves.map((mv) => mv.setAsideId)).toEqual(['kept'])
  })

  describe('across currencies', () => {
    /** What Set aside would read after the plan: every row converted on its own. */
    const afterPlan = (
      rows: ReadonlyArray<LocalSetAside>,
      moves: ReadonlyArray<RebalanceMove>,
      currency: string,
    ) =>
      rows.reduce((sum, r) => {
        const moved = moves
          .filter((mv) => mv.setAsideId === r.id)
          .reduce((total, mv) => total + mv.amount, 0)
        return sum + convertMinor(r.amount - moved, r.currency, currency, RATES)
      }, 0)

    it('keeps the amount in the row’s currency and leaves no minor unit over', () => {
      const rows = [
        row({
          id: 'usd-held',
          occurrence: '2026-11-01',
          amount: m(1001) + 33,
          currency: 'USD',
        }),
      ]
      const before = convertMinor(rows[0].amount, 'USD', 'SAR', RATES)
      for (const by of [1, 2, 3, 7, 101, 1234, 99999]) {
        const plan = suggest([over(by), room('b', m(50000))], rows)
        expect(plan.shortBy).toBe(0)
        expect(plan.moves[0]).toMatchObject({ currency: 'USD' })
        expect(afterPlan(rows, plan.moves, 'SAR')).toBeLessThanOrEqual(
          before - by,
        )
      }
    })

    it('never overfills a target in another currency', () => {
      const rows = [billRow('a', '2026-11-01', 1000)]
      const plan = suggest(
        [over(m(1000)), room('usd', 1001, 'USD'), room('kwd', 2001, 'KWD')],
        rows,
      )
      for (const mv of plan.moves) {
        const target = mv.toWalletId === 'usd' ? 1001 : 2001
        const into = mv.toWalletId === 'usd' ? 'USD' : 'KWD'
        expect(
          convertMinor(mv.amount, mv.currency, into, RATES),
        ).toBeLessThanOrEqual(target)
      }
      expect(plan.shortBy).toBeGreaterThan(0)
    })

    it('makes no move that would land as nothing', () => {
      // One halala is well under a tenth of a US cent.
      const plan = suggest(
        [over(1), room('usd', m(100), 'USD')],
        [billRow('a', '2026-11-01', 100)],
      )
      expect(plan.moves).toHaveLength(1)
      expect(plan.moves[0].amount).toBeGreaterThan(1)
      expect(
        convertMinor(plan.moves[0].amount, 'SAR', 'USD', RATES),
      ).toBeGreaterThan(0)
      expect(plan.shortBy).toBe(0)
    })

    it('leaves out a wallet there is no rate to reach', () => {
      const plan = suggest(
        [over(m(10)), room('xyz', m(100), 'XYZ')],
        [billRow('a', '2026-11-01', 100)],
      )
      expect(plan.moves).toEqual([])
      expect(plan.shortBy).toBe(m(10))
    })
  })
})
