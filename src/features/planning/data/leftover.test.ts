import { describe, expect, it } from 'vitest'
import {
  RATES,
  bill,
  m,
  planned,
  setAside,
} from '#/features/planned/testing/fixtures'
import { paymentRowsOf } from './occurrences'
import { occurrenceNeeds, spill } from './fill'
import { leftoverFor } from './leftover'

const INSURANCE = bill({
  id: 'ins',
  amount: m(1200),
  frequency: 'annual',
  nextDue: '2027-03-01',
  walletId: 'main',
})

const held = (
  walletId: string | null,
  amount: number,
  over: Parameters<typeof setAside>[0] = {},
) =>
  setAside({
    goalId: null,
    billId: 'ins',
    occurrence: '2027-03-01',
    source: walletId ? 'wallet' : 'outside',
    walletId,
    externalLabel: walletId ? null : 'Cash with mom',
    amount,
    ...over,
  })

const payments = (rows: ReturnType<typeof planned>[] = []) =>
  paymentRowsOf('ins', rows)

describe('leftoverFor', () => {
  it('lists what the occurrence still holds outside the paying wallet', () => {
    const report = leftoverFor({
      bill: INSURANCE,
      occurrence: '2027-03-01',
      payingWalletId: 'main',
      setAsides: [
        held('main', m(500)),
        held('savings', m(200)),
        held('savings', m(100)),
        held(null, m(50)),
        held('savings', m(999), { occurrence: '2028-03-01' }),
        held('savings', m(999), { releasedAt: '2027-02-01' }),
      ],
      payments: payments(),
      rates: RATES,
    })
    expect(report.lines).toEqual([
      expect.objectContaining({ walletId: 'savings', amount: m(300) }),
      expect.objectContaining({
        walletId: null,
        externalLabel: 'Cash with mom',
        amount: m(50),
      }),
    ])
    expect(report.lines[0].ids).toHaveLength(2)
    expect(report.total).toBe(m(350))
  })

  it('offers keeping it for the next open occurrence on a repeating bill only', () => {
    const paidAhead = planned({
      origin: 'bill',
      role: 'payment',
      goalId: null,
      billId: 'ins',
      occurrence: '2028-03-01',
      status: 'done',
    })
    const repeating = leftoverFor({
      bill: INSURANCE,
      occurrence: '2027-03-01',
      payingWalletId: 'main',
      setAsides: [],
      payments: payments([paidAhead]),
      rates: RATES,
    })
    expect(repeating).toMatchObject({
      canKeep: true,
      nextOccurrence: '2029-03-01',
    })
    const once = leftoverFor({
      bill: { ...INSURANCE, frequency: null },
      occurrence: '2027-03-01',
      payingWalletId: 'main',
      setAsides: [],
      payments: payments(),
      rates: RATES,
    })
    expect(once).toMatchObject({ canKeep: false, nextOccurrence: null })
  })
})

describe('fill-then-spill', () => {
  const RENT = bill({ id: 'rent', amount: m(3000), nextDue: '2026-10-01' })

  it('needs what each open occurrence lacks after set-asides and part payments', () => {
    const needs = occurrenceNeeds(
      RENT,
      paymentRowsOf('rent', [
        planned({
          origin: 'bill',
          role: 'payment',
          goalId: null,
          billId: 'rent',
          occurrence: '2026-11-01',
          status: 'done',
        }),
      ]),
      [
        setAside({
          goalId: null,
          billId: 'rent',
          occurrence: '2026-10-01',
          amount: m(1000),
        }),
      ],
      new Map(),
      RATES,
    )
    expect(needs.slice(0, 2)).toEqual([
      { occurrence: '2026-10-01', need: m(2000) },
      { occurrence: '2026-12-01', need: m(3000) },
    ])
  })

  it('fills the current occurrence, then spills into the next ones in order', () => {
    const needs = [
      { occurrence: '2026-10-01', need: m(2000) },
      { occurrence: '2026-11-01', need: m(3000) },
      { occurrence: '2026-12-01', need: m(3000) },
    ]
    expect(spill(needs, m(4500))).toEqual([
      { occurrence: '2026-10-01', amount: m(2000) },
      { occurrence: '2026-11-01', amount: m(2500) },
    ])
  })

  it('keeps any excess with the last occurrence, or the first when none needed money', () => {
    expect(spill([{ occurrence: 'a', need: m(100) }], m(150))).toEqual([
      { occurrence: 'a', amount: m(150) },
    ])
    expect(spill([{ occurrence: 'a', need: 0 }], m(150))).toEqual([
      { occurrence: 'a', amount: m(150) },
    ])
    expect(spill([], m(150))).toEqual([])
  })
})
