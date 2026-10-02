import { describe, expect, it } from 'vitest'
import type { SyncFailure } from '#/db/types'
import { describeSyncFailure } from './syncFailureMessages'

const failure = (over: Partial<SyncFailure>): SyncFailure => ({
  kind: 'rejected',
  status: 422,
  code: 'common.validation',
  field: null,
  message: '',
  at: '2026-09-26T10:00:00.000Z',
  ...over,
})

describe('describeSyncFailure', () => {
  it.each([0, 408, 429, 503])(
    'a %i is a wait-and-retry, never something to edit',
    (status) => {
      const text = describeSyncFailure(
        failure({ kind: 'unavailable', status, code: 'common.network' }),
      )
      expect(text.title).toBe('Not synced yet')
      expect(text.hint).toBe('We’ll keep retrying automatically.')
      expect(text.canFixByEditing).toBe(false)
    },
  )

  it('says the server could not be reached for a network failure', () => {
    expect(
      describeSyncFailure(failure({ kind: 'unavailable', status: 0 })).detail,
    ).toBe('Couldn’t reach the server.')
  })

  it.each([
    [
      'spending.transaction.wallet_invalid',
      'Wallet no longer available',
      'pick another wallet',
    ],
    [
      'spending.transaction.category_invalid',
      'Category no longer available',
      'pick another category',
    ],
    [
      'spending.transaction.goal_invalid',
      'Goal no longer available',
      'counts toward',
    ],
    [
      'spending.transaction.merchant_invalid',
      'Merchant no longer available',
      'pick another merchant',
    ],
    [
      'spending.transaction.planned_invalid',
      'Upcoming item no longer available',
      'counts toward',
    ],
    [
      'spending.transaction.category_type_mismatch',
      'Category doesn’t match',
      'same kind',
    ],
    [
      'spending.transfer.same_wallet',
      'Same wallet on both sides',
      'two different wallets',
    ],
    [
      'spending.transfer.wallet_invalid',
      'Wallet no longer available',
      'pick another wallet',
    ],
    [
      'spending.transfer.to_amount_mismatch',
      'Amount received not accepted',
      'amount received',
    ],
    [
      'spending.transaction.amount_invalid',
      'Amount not accepted',
      'correct the amount',
    ],
    [
      'spending.transaction.currency_invalid',
      'Currency not accepted',
      'wallet',
    ],
    ['spending.transaction.date_invalid', 'Date not accepted', 'date'],
    [
      'planned.wallet_invalid',
      'Wallet no longer available',
      'pick another wallet',
    ],
  ])('%s → "%s"', (code, title, hintPart) => {
    const text = describeSyncFailure(failure({ code }))
    expect(text.title).toBe(title)
    expect(text.hint.toLowerCase()).toContain(hintPart)
    expect(text.canFixByEditing).toBe(true)
  })

  it('names the wallet when the row knows it', () => {
    const text = describeSyncFailure(
      failure({
        code: 'spending.transaction.wallet_invalid',
        field: 'wallet_id',
      }),
      { wallet: 'Cash' },
    )
    expect(text.detail).toContain('The wallet “Cash”')
    expect(text.hint).toBe('Pick another wallet and save.')
  })

  it('names the side of a transfer the server pointed at', () => {
    const text = describeSyncFailure(
      failure({
        code: 'spending.transfer.wallet_invalid',
        field: 'to_wallet_id',
      }),
      { fromWallet: 'Cash', toWallet: 'Savings' },
    )
    expect(text.detail).toContain('“Savings”')
  })

  it('uses the catalog wording for a refused value', () => {
    expect(
      describeSyncFailure(
        failure({ code: 'spending.transaction.amount_invalid' }),
      ).detail,
    ).toBe('Enter a valid amount.')
  })

  it('points a generic validation failure at the field it names', () => {
    const text = describeSyncFailure(failure({ field: 'amount' }))
    expect(text.title).toBe('Some details weren’t accepted')
    expect(text.hint).toBe('Check the amount and save.')
  })

  it.each([
    ['planning.set_aside.owner_closed', 'Bill or goal is done'],
    ['planning.close.too_many_set_asides', 'Too much set aside to close at once'],
    ['spending.transaction.bill_type_mismatch', 'Only spending pays a bill'],
  ])('words the planning refusal %s plainly', (code, title) => {
    const text = describeSyncFailure(failure({ code }))
    expect(text.title).toBe(title)
    expect(text.detail).not.toBe('No reason was given.')
  })

  it('cannot be fixed by editing a transfer leg on its own', () => {
    expect(
      describeSyncFailure(
        failure({ code: 'spending.transaction.transfer_leg' }),
      ).canFixByEditing,
    ).toBe(false)
  })

  it('falls back to the server’s own words for a code it does not know', () => {
    const text = describeSyncFailure(
      failure({ code: 'spending.something.new', message: 'Nope, not today.' }),
    )
    expect(text.title).toBe('The server refused this change')
    expect(text.detail).toBe('Nope, not today.')
    expect(text.hint).toBe('Edit it and save again, or retry later.')
    expect(text.canFixByEditing).toBe(true)
  })

  it('still says something when the server gave no reason', () => {
    expect(
      describeSyncFailure(failure({ code: 'x.y.z', message: '' })).detail,
    ).toBe('No reason was given.')
  })
})
