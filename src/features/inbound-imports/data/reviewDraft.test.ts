import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import {
  categoryCandidates,
  confirmInput,
  draftState,
  initialDraft,
  resolveDraft,
} from './reviewDraft'
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

describe('categoryCandidates', () => {
  const merchant = [catId('shopping'), catId('dining')]

  it("leads with the merchant's categories for an inbox import", () => {
    const item = {
      source: 'inbox',
      suggestedCategoryId: catId('health'),
    } as LocalInboundImport
    expect(categoryCandidates(item, merchant)).toEqual([
      catId('shopping'),
      catId('dining'),
      catId('health'),
    ])
  })

  it("leads with a webhook's own suggestion", () => {
    const item = {
      source: 'webhook',
      suggestedCategoryId: catId('health'),
    } as LocalInboundImport
    expect(categoryCandidates(item, merchant)[0]).toBe(catId('health'))
  })
})

describe('initialDraft + resolveDraft', () => {
  const catalog = defaultCatalog()
  const wallets = [{ id: 'w1', currency: 'SAR' }] as LocalBalanceNode[]
  const item = {
    source: 'inbox',
    subject: 'Purchase alert',
    suggestedType: 'spend',
    suggestedCategoryId: null,
    suggestedWalletId: 'w1',
    amount: 3850,
    currency: 'SAR',
    occurredOn: '2026-09-25',
    suggestedMerchant: 'CARREFOUR',
  } as LocalInboundImport
  const draftFor = (candidates: string[], edits = {}) =>
    resolveDraft(
      { ...initialDraft(item, wallets, catalog, candidates), ...edits },
      item,
      wallets,
      catalog,
      candidates,
    )

  it('pre-selects the first candidate of the type, and falls back to Other without one', () => {
    expect(
      draftFor([catId('salary'), catId('groceries'), catId('dining')])
        .categoryId,
    ).toBe(catId('groceries'))
    expect(draftFor([]).categoryId).toBe(catId('other'))
  })

  it("keeps the user's pick over the candidates", () => {
    expect(
      draftFor([catId('groceries')], { categoryId: catId('dining') })
        .categoryId,
    ).toBe(catId('dining'))
  })

  it("leaves an email's note empty, but keeps the note a webhook read", () => {
    expect(draftFor([]).note).toBe('')
    const webhook = { ...item, source: 'webhook', subject: 'Lunch' } as const
    expect(initialDraft(webhook, wallets, catalog, []).note).toBe('Lunch')
  })
})
