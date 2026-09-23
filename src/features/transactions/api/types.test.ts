import { describe, expect, it } from 'vitest'
import { toBudget, toTransaction } from './types'
import type { BudgetWire, TransactionWire } from './types'

const aTxWire = (currency: string): TransactionWire => ({
  id: 't1',
  type: 'SPEND',
  amount: 4500,
  currency,
  category: 'food',
  subcategory: null,
  wallet_id: 'w1',
  goal_id: null,
  merchant_id: null,
  date: '2026-09-01',
  note: null,
  source: null,
  transfer_id: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v1',
})

const aBudgetWire = (currency: string): BudgetWire => ({
  id: 'b1',
  scope_type: 'CATEGORY',
  target: 'food',
  period: 'MONTHLY',
  custom_days: null,
  limit_amount: 100000,
  currency,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v1',
})

describe('spending mappers', () => {
  it('accepts any ISO code the config lists', () => {
    expect(toTransaction(aTxWire('JPY')).currency).toBe('JPY')
    expect(toBudget(aBudgetWire('KWD')).currency).toBe('KWD')
  })

  it('maps a transfer leg with its link and no category', () => {
    const leg = toTransaction({
      ...aTxWire('SAR'),
      type: 'TRANSFER_IN',
      category: null,
      transfer_id: 'tr1',
    })
    expect(leg).toMatchObject({
      type: 'transfer_in',
      category: null,
      transferId: 'tr1',
    })
  })

  it('rejects an unknown currency code', () => {
    expect(() => toTransaction(aTxWire('XXX'))).toThrow(/XXX/)
    expect(() => toBudget(aBudgetWire('XXX'))).toThrow()
  })
})
