import { describe, expect, it } from 'vitest'
import { RATES, m, tx, wallet } from '#/features/planned/testing/fixtures'
import { balanceAt, buildBalanceStrip } from './balances'
import { reportRange } from './range'
import type { RangePreset } from './range'

const TODAY = new Date(2026, 8, 29)

const range = (preset: RangePreset = 'this_month') =>
  reportRange(preset, { start: '', end: '' }, 'none', TODAY)

const wallets = [
  wallet({ id: 'w1', amount: m(1000), currency: 'SAR' }),
  wallet({ id: 'w2', amount: m(100), currency: 'USD' }),
]

const reader = (
  rows = [
    tx({ type: 'income', walletId: 'w1', amount: m(200), date: '2026-09-05' }),
    tx({
      type: 'spend',
      walletId: 'w2',
      amount: m(20),
      currency: 'USD',
      date: '2026-09-10',
    }),
    tx({
      type: 'spend',
      walletId: 'w1',
      amount: m(999),
      date: '2026-09-12',
      deleted: 1,
    }),
  ],
) =>
  balanceAt({
    wallets,
    before: { w1: m(500) },
    rows,
    base: 'SAR',
    rates: RATES,
  })

describe('balanceAt', () => {
  it('starts from the opening amounts plus everything before the period', () => {
    expect(reader()('2026-08-31')).toBe(m(1500) + m(375))
  })

  it('adds the period rows up to the day asked, per wallet in base', () => {
    const read = reader()
    expect(read('2026-09-05')).toBe(m(1875) + m(200))
    expect(read('2026-09-10')).toBe(m(2075) - m(75))
    expect(read('2026-09-29')).toBe(m(2000))
  })

  it('moves with transfers and adjustments too', () => {
    const read = reader([
      tx({
        type: 'transfer_out',
        walletId: 'w1',
        categoryId: null,
        amount: m(300),
        date: '2026-09-02',
      }),
      tx({
        type: 'transfer_in',
        walletId: 'w2',
        categoryId: null,
        amount: m(80),
        currency: 'USD',
        date: '2026-09-02',
      }),
      tx({
        type: 'adjustment_in',
        walletId: 'w1',
        categoryId: null,
        amount: m(50),
        date: '2026-09-03',
      }),
    ])
    expect(read('2026-09-02')).toBe(m(1875) - m(300) + m(300))
    expect(read('2026-09-03')).toBe(m(1925))
  })
})

describe('buildBalanceStrip', () => {
  it('reads the start, today and the change, noting when it equals net', () => {
    const strip = buildBalanceStrip(reader(), range(), m(125), true, 'SAR')
    expect(strip).toEqual({
      startStr: 'SR 1,875',
      startDate: 'Sep 1, 2026',
      endLabel: 'Balance today',
      endStr: 'SR 2,000',
      endDate: 'Sep 29, 2026',
      changeStr: '+SR 125',
      changePositive: true,
      note: 'Equals net for the period',
    })
  })

  it('treats a change within the same whole unit as equal to net', () => {
    const read = (iso: string) => (iso === '2026-08-31' ? 0 : 12_540)
    expect(buildBalanceStrip(read, range(), 12_510, false, 'SAR').note).toBe(
      'Equals net for the period',
    )
  })

  it('explains a change that is not the net', () => {
    const read = reader()
    expect(buildBalanceStrip(read, range(), m(100), true, 'SAR').note).toBe(
      'Net plus balance adjustments',
    )
    expect(buildBalanceStrip(read, range(), m(100), false, 'SAR').note).toBe(
      'Includes transfers in and out',
    )
  })

  it('calls a finished period its ending balance, and signs a drop', () => {
    const read = (iso: string) => (iso === '2026-07-31' ? m(500) : -m(200))
    const strip = buildBalanceStrip(
      read,
      range('last_month'),
      -m(700),
      true,
      'SAR',
    )
    expect(strip.endLabel).toBe('Ending balance')
    expect(strip.startDate).toBe('Aug 1, 2026')
    expect(strip.endDate).toBe('Aug 31, 2026')
    expect(strip.endStr).toBe('−SR 200')
    expect(strip.changeStr).toBe('−SR 700')
    expect(strip.changePositive).toBe(false)
  })
})
