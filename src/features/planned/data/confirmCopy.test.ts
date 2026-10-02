import { describe, expect, it } from 'vitest'
import { m } from '#/features/planned/testing/fixtures'
import { effectLine, dueLine, primaryLabel } from './confirmCopy'
import type { ConfirmPreview } from './preview'

const SET_ASIDE = { currency: 'SAR', role: 'set_aside' as const }
const PAYDAY = { currency: 'SAR', role: 'income' as const }

const preview = (over: Partial<ConfirmPreview>): ConfirmPreview => ({
  kind: 'full',
  leftOpen: 0,
  excess: 0,
  goal: null,
  wallet: null,
  ...over,
})

const umrah = (over: Partial<NonNullable<ConfirmPreview['goal']>> = {}) => ({
  id: 'umrah',
  name: 'Umrah trip',
  savedAfter: m(5500),
  target: m(13000),
  liveAmountAfter: m(1500),
  storedAmount: m(1500),
  ...over,
})

describe('dueLine', () => {
  it('says how far the planned date is from today', () => {
    expect(dueLine('2026-09-01', '2026-09-24')).toBe(
      'Due Sep 1 · 23 days ago',
    )
    expect(dueLine('2026-09-27', '2026-09-24')).toBe(
      'Due Sep 27 · in 3 days',
    )
    expect(dueLine('2026-09-24', '2026-09-24')).toBe(
      'Due Sep 24 · today',
    )
  })
})

describe('effectLine', () => {
  it('asks for an amount when there is none', () => {
    expect(
      effectLine({
        item: SET_ASIDE,
        preview: preview({ kind: 'empty' }),
        wallet: null,
        goalCurrency: 'SAR',
      }),
    ).toEqual({ text: 'Enter an amount to confirm.', tone: 'neutral' })
  })

  it('says a full set-aside puts the goal back on its plan', () => {
    const e = effectLine({
      item: SET_ASIDE,
      preview: preview({ goal: umrah() }),
      wallet: null,
      goalCurrency: 'SAR',
    })
    expect(e.tone).toBe('good')
    expect(e.text).toBe(
      'Umrah trip goes to SR 5,500.00 of SR 13,000.00 and is back on the SR 1,500.00/mo plan.',
    )
  })

  it('does not claim "back on plan" when the live plan still differs', () => {
    const e = effectLine({
      item: SET_ASIDE,
      preview: preview({ goal: umrah({ liveAmountAfter: m(1800) }) }),
      wallet: null,
      goalCurrency: 'SAR',
    })
    expect(e.text).toBe('Umrah trip goes to SR 5,500.00 of SR 13,000.00.')
  })

  it('spells out what a partial leaves open and the new plan', () => {
    const e = effectLine({
      item: SET_ASIDE,
      preview: preview({
        kind: 'partial',
        leftOpen: m(500),
        goal: umrah({ savedAfter: m(5000), liveAmountAfter: m(1600) }),
      }),
      wallet: null,
      goalCurrency: 'SAR',
    })
    expect(e.tone).toBe('partial')
    expect(e.text).toBe(
      'Partial: SR 500.00 stays open on this item. Umrah trip would be SR 5,000.00 of SR 13,000.00; remaining plan becomes SR 1,600.00/mo.',
    )
  })

  it('names the excess when more than planned is paid', () => {
    const e = effectLine({
      item: SET_ASIDE,
      preview: preview({ kind: 'over', excess: m(200), goal: umrah() }),
      wallet: null,
      goalCurrency: 'SAR',
    })
    expect(e.text.startsWith('SR 200.00 more than planned. ')).toBe(true)
  })

  it('shows the wallet balance an income lands in', () => {
    const e = effectLine({
      item: PAYDAY,
      preview: preview({ wallet: { id: 'w1', balanceAfter: m(24310) } }),
      wallet: { name: 'Main Checking', currency: 'SAR' },
      goalCurrency: null,
    })
    expect(e.text).toBe('Main Checking goes to SR 24,310.00.')
  })
})

describe('primaryLabel', () => {
  const base = { amount: m(1000), currency: 'SAR', early: false }
  it('varies by role, partial and early', () => {
    expect(primaryLabel({ ...base, role: 'set_aside', kind: 'full' })).toBe(
      'Confirm as paid',
    )
    expect(primaryLabel({ ...base, role: 'income', kind: 'full' })).toBe(
      'Confirm received',
    )
    expect(primaryLabel({ ...base, role: 'payment', kind: 'partial' })).toBe(
      'Confirm partial SR 1,000.00',
    )
    expect(
      primaryLabel({ ...base, role: 'payment', kind: 'full', early: true }),
    ).toBe('Confirm early')
  })
})
