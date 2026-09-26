// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LocalBalanceNode,
  LocalCategory,
  LocalInboundImport,
} from '#/db/types'
import { buildCatalog } from '#/features/categories/data/catalog'
import {
  catId,
  categoryRow,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { useImportReview } from './useImportReview'

const confirmImport = vi.fn()
const dismissImport = vi.fn()

vi.mock('#/features/inbound-imports/data/mutations', () => ({
  confirmImport: (...args: unknown[]) => confirmImport(...args),
  dismissImport: (...args: unknown[]) => dismissImport(...args),
}))

const WALLET = {
  id: 'w1',
  name: 'Main',
  currency: 'SAR',
} as LocalBalanceNode

const anImport = (
  over: Partial<LocalInboundImport> = {},
): LocalInboundImport => ({
  id: 'i1',
  source: 'inbox',
  connectionId: 'c1',
  keyId: null,
  ruleId: null,
  merchantId: 'm1',
  sourceRef: 'alerts@riyadbank.com',
  sourceLabel: 'Riyad Bank Alerts',
  subject: 'Purchase authorization',
  occurredOn: '2026-06-12',
  amount: 24500,
  currency: 'SAR',
  suggestedMerchant: 'CARREFOUR HYPERMARKET',
  suggestedCategoryId: catId('groceries'),
  suggestedType: null,
  suggestedWalletId: null,
  rawPreview: 'Amount: SAR 245.00',
  hasBody: true,
  bodyFormat: 'text',
  status: 'pending',
  transactionId: null,
  createdAt: '2026-06-13T00:00:00Z',
  version: 'v1',
  ...over,
})

const BUILT_INS = defaultCatalog()

const review = (item: LocalInboundImport, rows?: LocalCategory[]) =>
  renderHook(() =>
    useImportReview(
      item,
      [WALLET],
      rows === undefined ? BUILT_INS : buildCatalog(rows),
    ),
  )

beforeEach(() => {
  confirmImport.mockReset().mockResolvedValue(undefined)
  dismissImport.mockReset().mockResolvedValue(undefined)
})

describe('useImportReview', () => {
  it('prefills the draft from what the sync parsed', () => {
    const { result } = review(anImport())
    expect(result.current.draft).toMatchObject({
      amount: '245',
      currency: 'SAR',
      date: '2026-06-12',
      categoryId: catId('groceries'),
      walletId: 'w1',
      merchant: 'CARREFOUR HYPERMARKET',
    })
    expect(result.current.needsDetails).toBe(false)
  })

  it('leaves the amount blank and flags an alert that parsed empty', () => {
    const { result } = review(anImport({ amount: null, currency: null }))
    expect(result.current.draft.amount).toBe('')
    expect(result.current.needsDetails).toBe(true)
  })

  it('fills amount and currency from a line tapped in the email', () => {
    const { result } = review(
      anImport({ amount: null, currency: null, suggestedCategoryId: null }),
    )
    act(() => result.current.useLine('Amount: USD 89.00'))
    expect(result.current.draft.amount).toBe('89')
    expect(result.current.draft.currency).toBe('USD')
  })

  it('refuses to confirm without an amount and says where to find one', async () => {
    const { result } = review(anImport({ amount: null, currency: null }))
    await act(async () => {
      await result.current.confirm()
    })
    expect(confirmImport).not.toHaveBeenCalled()
    expect(result.current.amountError).toMatch(/tap it in the email above/i)
    expect(result.current.error).toBe(
      'Add the amount and currency from the details above.',
    )
  })

  it('confirms with the typed-in values as overrides', async () => {
    const { result } = review(anImport({ amount: null, currency: null }))
    act(() => result.current.useLine('Amount: SAR 89.00'))
    await act(async () => {
      await result.current.confirm()
    })
    expect(confirmImport).toHaveBeenCalledTimes(1)
    expect(confirmImport.mock.calls[0][1]).toMatchObject({
      walletId: 'w1',
      amount: 8900,
      currency: 'SAR',
      date: '2026-06-12',
      type: 'spend',
      categoryId: catId('groceries'),
    })
  })

  it('confirms the chosen subcategory by its own id', async () => {
    const { result } = review(anImport())
    act(() => result.current.setSubcategory(catId('supermarket', 'groceries')))
    expect(result.current.rootId).toBe(catId('groceries'))
    expect(result.current.subcategoryId).toBe(catId('supermarket', 'groceries'))
    await act(async () => {
      await result.current.confirm()
    })
    expect(confirmImport.mock.calls[0][1].categoryId).toBe(
      catId('supermarket', 'groceries'),
    )

    act(() => result.current.setSubcategory(null))
    expect(result.current.draft.categoryId).toBe(catId('groceries'))
  })

  it('sends the merchant only when the user edited it', async () => {
    const { result } = review(anImport())
    await act(async () => {
      await result.current.confirm()
    })
    // Unchanged: omitted, so the backend doesn't count the sighting twice.
    expect(confirmImport.mock.calls[0][1].merchant).toBeUndefined()

    act(() => result.current.setField('merchant', 'Tamimi Markets'))
    await act(async () => {
      await result.current.confirm()
    })
    expect(confirmImport.mock.calls[1][1].merchant).toBe('Tamimi Markets')
  })

  it('files under a category the user created, with its own children', () => {
    const rows = [
      categoryRow({ id: 'mine', slug: 'groceries', name: 'Food shopping' }),
      categoryRow({
        id: 'sub-1',
        slug: 'farmers_market',
        name: 'Farmers market',
        parentId: 'mine',
      }),
    ]
    const { result } = review(anImport({ suggestedCategoryId: 'sub-1' }), rows)
    expect(result.current.draft.categoryId).toBe('sub-1')
    expect(result.current.rootId).toBe('mine')
    expect(result.current.subcategoryId).toBe('sub-1')
    expect(result.current.categories.map((c) => c.name)).toEqual([
      'Food shopping',
    ])
    expect(result.current.subs.map((s) => s.slug)).toEqual(['farmers_market'])
  })

  it('falls back to the type’s fallback when the suggestion is not in the catalog', () => {
    const { result } = review(anImport({ suggestedCategoryId: 'gone' }))
    expect(result.current.draft.categoryId).toBe(catId('other'))
    expect(result.current.subcategoryId).toBeNull()
  })

  it('upgrades to the suggestion once the categories arrive', () => {
    const item = anImport()
    const { result, rerender } = renderHook(
      ({ catalog }) => useImportReview(item, [WALLET], catalog),
      { initialProps: { catalog: buildCatalog([]) } },
    )
    expect(result.current.draft.categoryId).toBe('')
    rerender({ catalog: BUILT_INS })
    expect(result.current.draft.categoryId).toBe(catId('groceries'))
  })

  it('starts from the type and account the source suggested', () => {
    const savings = {
      id: 'w2',
      name: 'Savings',
      currency: 'USD',
    } as LocalBalanceNode
    const { result } = renderHook(() =>
      useImportReview(
        anImport({
          suggestedType: 'income',
          suggestedWalletId: 'w2',
          currency: null,
        }),
        [WALLET, savings],
        BUILT_INS,
      ),
    )
    expect(result.current.draft.type).toBe('income')
    expect(result.current.draft.walletId).toBe('w2')
    expect(result.current.draft.currency).toBe('USD')
  })

  it('takes the direction from the suggested category when the source named none', () => {
    const { result } = review(
      anImport({ suggestedType: null, suggestedCategoryId: catId('salary') }),
    )
    expect(result.current.draft.type).toBe('income')
    expect(result.current.draft.categoryId).toBe(catId('salary'))
  })

  it('lands on the suggested account when the accounts load after the row', () => {
    const savings = {
      id: 'w2',
      name: 'Savings',
      currency: 'SAR',
    } as LocalBalanceNode
    const item = anImport({ suggestedWalletId: 'w2' })
    const { result, rerender } = renderHook(
      ({ wallets }) => useImportReview(item, wallets, BUILT_INS),
      { initialProps: { wallets: [] as LocalBalanceNode[] } },
    )
    expect(result.current.draft.walletId).toBe('')

    rerender({ wallets: [WALLET, savings] })
    expect(result.current.draft.walletId).toBe('w2')

    act(() => result.current.setField('walletId', 'w1'))
    expect(result.current.draft.walletId).toBe('w1')
  })

  it('falls back to the first account when the suggested one is gone', () => {
    const { result } = review(anImport({ suggestedWalletId: 'deleted' }))
    expect(result.current.draft.walletId).toBe('w1')
  })

  it('fills the target from a tapped payload value and hops to the next field', () => {
    const { result } = review(
      anImport({
        source: 'webhook',
        bodyFormat: 'json',
        amount: null,
        currency: null,
      }),
    )
    expect(result.current.target).toBe('amount')

    act(() => result.current.pick({ value: '38.00', text: '38.00' }))
    expect(result.current.draft.amount).toBe('38')
    expect(result.current.target).toBe('currency')

    act(() => result.current.pick({ value: 'usd', text: 'usd' }))
    expect(result.current.draft.currency).toBe('USD')
    expect(result.current.target).toBe('date')

    act(() => result.current.pick({ value: 'soon', text: 'soon' }))
    expect(result.current.error).toBe('“soon” doesn’t read as a date.')
    expect(result.current.draft.date).toBe('2026-06-12')
  })

  it('points a webhook row’s missing amount at the payload', async () => {
    const { result } = review(
      anImport({ bodyFormat: 'json', amount: null, currency: null }),
    )
    await act(async () => {
      await result.current.confirm()
    })
    expect(result.current.amountError).toMatch(/tap it in the payload/i)
  })

  it('switching to income re-points the category at an income one', () => {
    const { result } = review(anImport())
    act(() => result.current.setType('income'))
    expect(result.current.draft.type).toBe('income')
    expect(result.current.draft.categoryId).toBe(catId('other_income'))
  })
})
