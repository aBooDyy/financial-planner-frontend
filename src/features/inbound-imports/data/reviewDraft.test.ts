import { describe, expect, it } from 'vitest'
import type { LocalInboundImport } from '#/db/types'
import { confirmInput, draftState } from './reviewDraft'
import type { ReviewDraft } from './reviewDraft'

const DRAFT: ReviewDraft = {
  type: 'spend',
  amount: '38.50',
  currency: 'SAR',
  date: '2026-09-25',
  categoryId: 'food',
  walletId: 'w1',
  merchant: 'STARBUCKS RIYADH',
  note: '',
}

const ITEM = { suggestedMerchant: 'STARBUCKS RIYADH' } as LocalInboundImport

describe('draftState', () => {
  it('is ready with an amount, a currency, an account and a category', () => {
    expect(draftState(DRAFT)).toEqual({
      amountMissing: false,
      currencyMissing: false,
      needsDetails: false,
      ready: true,
    })
  })

  it('needs details without an amount, and is not ready without an account', () => {
    expect(draftState({ ...DRAFT, amount: '' })).toMatchObject({
      amountMissing: true,
      needsDetails: true,
      ready: false,
    })
    expect(draftState({ ...DRAFT, walletId: '' })).toMatchObject({
      needsDetails: false,
      ready: false,
    })
  })
})

describe('confirmInput', () => {
  it('sends the merchant only when it was edited', () => {
    const same = confirmInput(ITEM, DRAFT)
    const edited = confirmInput(ITEM, { ...DRAFT, merchant: 'Starbucks' })

    expect('input' in same && same.input.merchant).toBeUndefined()
    expect('input' in edited && edited.input.merchant).toBe('Starbucks')
    expect('input' in same && same.input.amount).toBe(3850)
  })

  it('says what is missing instead of confirming', () => {
    expect(confirmInput(ITEM, { ...DRAFT, amount: '0' })).toEqual({
      problem: 'Enter the amount.',
    })
    expect(confirmInput(ITEM, { ...DRAFT, categoryId: '' })).toEqual({
      problem: 'Choose a category for this entry.',
    })
  })
})
