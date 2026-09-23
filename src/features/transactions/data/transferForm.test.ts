import { describe, expect, it } from 'vitest'
import type { CurrencyCode } from '#/lib/currency'
import { resolveTransfer } from './transferForm'

const CURRENCIES: Record<string, CurrencyCode> = {
  a: 'SAR',
  b: 'SAR',
  u: 'USD',
}
const currencyOf = (id: string): CurrencyCode => CURRENCIES[id] ?? 'SAR'

const draft = (over: Partial<Parameters<typeof resolveTransfer>[0]> = {}) => ({
  walletId: 'a',
  toWalletId: 'b',
  amount: '50',
  toAmount: '',
  ...over,
})

describe('resolveTransfer', () => {
  it('mirrors the amount for a same-currency transfer', () => {
    expect(resolveTransfer(draft(), currencyOf)).toEqual({
      amount: 5000,
      fromCurrency: 'SAR',
      toAmount: 5000,
      toCurrency: 'SAR',
    })
  })

  it('rejects a missing or non-positive amount', () => {
    expect(resolveTransfer(draft({ amount: '' }), currencyOf)).toBeNull()
    expect(resolveTransfer(draft({ amount: '0' }), currencyOf)).toBeNull()
  })

  it('rejects the same account on both sides', () => {
    expect(resolveTransfer(draft({ toWalletId: 'a' }), currencyOf)).toBeNull()
  })

  it('needs a received amount across currencies', () => {
    expect(resolveTransfer(draft({ toWalletId: 'u' }), currencyOf)).toBeNull()
    expect(
      resolveTransfer(
        draft({ toWalletId: 'u', toAmount: '13.33' }),
        currencyOf,
      ),
    ).toMatchObject({ toAmount: 1333, toCurrency: 'USD' })
  })

  it('uses the surviving side alone when the other account is gone', () => {
    expect(
      resolveTransfer(
        draft({ walletId: '', toWalletId: 'u' }),
        currencyOf,
        'from',
      ),
    ).toMatchObject({ fromCurrency: 'USD', toCurrency: 'USD', toAmount: 5000 })
    expect(
      resolveTransfer(draft({ toWalletId: '' }), currencyOf, 'to'),
    ).not.toBeNull()
  })
})
