import { describe, expect, it } from 'vitest'
import {
  RATES,
  bill,
  goal,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { setAsideFor, walletSetAsides } from './totals'

const main = wallet({ id: 'main' })
const dollars = wallet({ id: 'dollars', currency: 'USD' })
const trip = goal({ id: 'trip', name: 'Trip', color: '#EC4899' })
const rent = bill({ id: 'rent', name: 'Rent', color: '#8B5CF6' })

describe('walletSetAsides', () => {
  it('sums live wallet set-asides per bill and goal, largest first', () => {
    const lines = walletSetAsides(
      [
        setAside({ goalId: 'trip', walletId: 'main', amount: m(100) }),
        setAside({ goalId: 'trip', walletId: 'main', amount: m(50) }),
        setAside({
          goalId: null,
          billId: 'rent',
          occurrence: '2026-10-01',
          walletId: 'main',
          amount: m(3000),
        }),
      ],
      [trip],
      [rent],
      [main],
      RATES,
    )
    expect(lines.main).toEqual([
      {
        ownerId: 'rent',
        owner: 'bill',
        ownerName: 'Rent',
        color: '#8B5CF6',
        amount: m(3000),
      },
      {
        ownerId: 'trip',
        owner: 'goal',
        ownerName: 'Trip',
        color: '#EC4899',
        amount: m(150),
      },
    ])
  })

  it('leaves out released rows, money held outside and unknown wallets', () => {
    const lines = walletSetAsides(
      [
        setAside({
          goalId: 'trip',
          walletId: 'main',
          releasedAt: '2026-09-01',
        }),
        setAside({
          goalId: 'trip',
          source: 'outside',
          walletId: null,
          externalLabel: 'Dad',
        }),
        setAside({ goalId: 'trip', walletId: 'gone' }),
      ],
      [trip],
      [],
      [main],
      RATES,
    )
    expect(lines).toEqual({})
  })

  it('states each line in the wallet’s own currency', () => {
    const lines = walletSetAsides(
      [setAside({ goalId: 'trip', walletId: 'dollars', amount: m(375) })],
      [trip],
      [],
      [dollars],
      RATES,
    )
    expect(lines.dollars[0].amount).toBe(m(100))
  })
})

describe('setAsideFor', () => {
  it('sums one owner’s live set-asides in the asked currency', () => {
    const rows = [
      setAside({ goalId: 'trip', amount: m(100) }),
      setAside({ goalId: 'trip', amount: m(40), releasedAt: '2026-09-01' }),
      setAside({ goalId: null, billId: 'rent', amount: m(70) }),
    ]
    expect(setAsideFor('trip', rows, 'SAR', RATES)).toBe(m(100))
    expect(setAsideFor('rent', rows, 'SAR', RATES)).toBe(m(70))
  })
})
