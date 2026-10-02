import { describe, expect, it } from 'vitest'
import { RATES, m, setAside } from '#/features/planned/testing/fixtures'
import {
  adjustWarning,
  heldIn,
  heldTotalStr,
  partsForPicks,
  pickHeld,
  setAsideShare,
  transferPromptText,
} from './setAsideMoves'

const line = (ownerId: string, ownerName: string, amount: number) => ({
  ownerId,
  owner: 'goal' as const,
  ownerName,
  color: '#000',
  amount,
})

describe('setAsideShare', () => {
  it('is what goes beyond Free to spend, never more than is set aside', () => {
    // Balance 1,000, set aside 600 → free 400.
    expect(setAsideShare(m(1000), m(600), m(300))).toBe(0)
    expect(setAsideShare(m(1000), m(600), m(800))).toBe(m(400))
    expect(setAsideShare(m(1000), m(600), m(5000))).toBe(m(600))
    // Already over-committed: every riyal moved is set-aside money.
    expect(setAsideShare(m(500), m(600), m(100))).toBe(m(100))
  })
})

describe('pickHeld', () => {
  it('takes the share from the largest set-asides first', () => {
    const picks = pickHeld(
      [line('umrah', 'Umrah', m(100)), line('car', 'Car insurance', m(300))],
      m(350),
    )
    expect(picks.map((p) => [p.ownerName, p.amount])).toEqual([
      ['Car insurance', m(300)],
      ['Umrah', m(50)],
    ])
    expect(transferPromptText(m(350), picks, 'SAR')).toBe(
      'SR 350.00 of this is set aside (Car insurance SR 300.00, Umrah SR 50.00). Move those set-asides with it?',
    )
  })
})

describe('partsForPicks', () => {
  it('acts on the oldest rows first and cuts the last one', () => {
    const rows = [
      setAside({
        id: 'new',
        goalId: 'car',
        amount: m(200),
        date: '2026-09-10',
      }),
      setAside({
        id: 'old',
        goalId: 'car',
        amount: m(100),
        date: '2026-08-10',
      }),
      setAside({ id: 'other', goalId: 'umrah', amount: m(100) }),
      setAside({
        id: 'freed',
        goalId: 'car',
        amount: m(100),
        date: '2026-07-01',
        releasedAt: '2026-07-02',
      }),
      setAside({
        id: 'elsewhere',
        goalId: 'car',
        walletId: 'w2',
        amount: m(900),
      }),
    ]
    expect(
      partsForPicks(
        rows,
        'w1',
        'SAR',
        [{ ownerId: 'car', owner: 'goal', ownerName: 'Car', amount: m(250) }],
        RATES,
      ),
    ).toEqual([{ id: 'old' }, { id: 'new', amount: m(150) }])
  })

  it('lists every live set-aside held in a set of wallets', () => {
    const rows = [
      setAside({ id: 'a', walletId: 'w1' }),
      setAside({ id: 'b', walletId: 'w2' }),
      setAside({ id: 'c', walletId: 'w1', releasedAt: '2026-09-01' }),
      setAside({ id: 'd', source: 'outside', walletId: null }),
    ]
    expect(heldIn(rows, new Set(['w1', 'w2'])).map((a) => a.id)).toEqual([
      'a',
      'b',
    ])
  })
})

describe('adjustWarning', () => {
  it('warns only when the new balance is below what is set aside', () => {
    expect(adjustWarning('Main bank', m(1500), m(1900), 'SAR')).toBe(
      'Main bank holds SR 1,900.00 set aside. At SR 1,500.00 it would be SR 400.00 over-committed.',
    )
    expect(adjustWarning('Main bank', m(2000), m(1900), 'SAR')).toBeNull()
    expect(adjustWarning('Main bank', m(-5), 0, 'SAR')).toBeNull()
  })
})

describe('heldTotalStr', () => {
  it('adds up what the wallets hold set aside, in base', () => {
    const rows = [
      setAside({ id: 'a', walletId: 'w1', amount: m(300) }),
      setAside({ id: 'b', walletId: 'w2', amount: m(100), currency: 'USD' }),
      setAside({ id: 'c', walletId: 'w3', amount: m(999) }),
      setAside({
        id: 'd',
        walletId: 'w1',
        amount: m(50),
        releasedAt: '2026-09-02',
      }),
    ]
    expect(heldTotalStr(rows, new Set(['w1', 'w2']), 'SAR', RATES)).toBe(
      'SR 675.00',
    )
  })

  it('is null when they hold nothing', () => {
    expect(heldTotalStr([], new Set(['w1']), 'SAR', RATES)).toBeNull()
  })
})
