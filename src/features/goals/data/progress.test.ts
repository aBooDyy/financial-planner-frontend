import { describe, expect, it } from 'vitest'
import {
  RATES,
  goal,
  m,
  setAside,
  tx,
} from '#/features/planned/testing/fixtures'
import { goalProgress } from './progress'

/** A goal's progress is its live set-asides plus what was already used from it. */

const umrah = goal({ id: 'umrah', target: m(13000), dueDate: '2027-06-01' })

const putAside = (amount: number, walletId: string | null = 'main') =>
  setAside({
    goalId: 'umrah',
    amount,
    source: walletId ? 'wallet' : 'outside',
    walletId,
    externalLabel: walletId ? null : 'Dad',
  })

describe('goalProgress', () => {
  it('adds live set-asides to what was used from the goal', () => {
    const p = goalProgress(
      [umrah],
      [putAside(m(5000)), putAside(m(1000), 'savings')],
      [tx({ goalId: 'umrah', amount: m(2000), type: 'spend' })],
      RATES,
    ).umrah!
    expect(p.setAside).toBe(m(6000))
    expect(p.used).toBe(m(2000))
    expect(p.progress).toBe(m(8000))
    expect(p.byWallet).toEqual({ main: m(5000), savings: m(1000) })
    expect(p.outside).toBe(0)
  })

  it('leaves released and deleted set-asides out', () => {
    const p = goalProgress(
      [umrah],
      [
        putAside(m(500)),
        { ...putAside(m(700)), releasedAt: '2026-09-01' },
        { ...putAside(m(900)), deleted: 1 },
      ],
      [],
      RATES,
    ).umrah!
    expect(p.setAside).toBe(m(500))
  })

  it('counts money held outside apart from the wallets', () => {
    const p = goalProgress([umrah], [putAside(m(300), null)], [], RATES).umrah!
    expect(p.outside).toBe(m(300))
    expect(p.byWallet).toEqual({})
  })

  it('converts into the goal currency and ignores income and other goals', () => {
    const p = goalProgress(
      [umrah],
      [{ ...putAside(10_000), currency: 'USD' }],
      [
        tx({ goalId: 'umrah', amount: m(50), type: 'income' }),
        tx({ goalId: 'other', amount: m(50), type: 'spend' }),
      ],
      RATES,
    ).umrah!
    expect(p.setAside).toBe(37_500)
    expect(p.used).toBe(0)
  })
})
