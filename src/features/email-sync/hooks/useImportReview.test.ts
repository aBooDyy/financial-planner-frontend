// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalBalanceNode, LocalPendingImport } from '#/db/types'
import { useImportReview } from './useImportReview'

const confirmImport = vi.fn()
const dismissImport = vi.fn()

vi.mock('#/features/email-sync/data/mutations', () => ({
  confirmImport: (...args: unknown[]) => confirmImport(...args),
  dismissImport: (...args: unknown[]) => dismissImport(...args),
}))

const WALLET = {
  id: 'w1',
  name: 'Main',
  currency: 'SAR',
} as LocalBalanceNode

const anImport = (
  over: Partial<LocalPendingImport> = {},
): LocalPendingImport => ({
  id: 'i1',
  connectionId: 'c1',
  merchantId: 'm1',
  senderEmail: 'alerts@riyadbank.com',
  senderName: 'Riyad Bank Alerts',
  subject: 'Purchase authorization',
  emailDate: '2026-06-12',
  amount: 24500,
  currency: 'SAR',
  suggestedMerchant: 'CARREFOUR HYPERMARKET',
  suggestedCategory: 'groceries',
  suggestedSubcategory: null,
  rawPreview: 'Amount: SAR 245.00',
  hasBody: true,
  status: 'pending',
  transactionId: null,
  createdAt: '2026-06-13T00:00:00Z',
  version: 'v1',
  ...over,
})

const review = (item: LocalPendingImport) =>
  renderHook(() => useImportReview(item, [WALLET]))

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
      category: 'groceries',
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
      anImport({ amount: null, currency: null, suggestedCategory: null }),
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
    expect(result.current.error).toMatch(/tap it in the email/i)
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
    })
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

  it('switching to income re-points the category at an income one', () => {
    const { result } = review(anImport())
    act(() => result.current.setType('income'))
    expect(result.current.draft.type).toBe('income')
    expect(result.current.draft.category).not.toBe('groceries')
  })
})
