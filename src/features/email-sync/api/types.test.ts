import { describe, expect, it } from 'vitest'
import type { ConnectionWire, ImportWire } from './types'
import {
  fromWireFrequency,
  toConnection,
  toImport,
  toImportDetail,
  toWireFrequency,
  toWireProvider,
} from './types'

const importWire = (): ImportWire => ({
  id: 'i1',
  connection_id: 'c1',
  rule_id: 'r1',
  transaction_id: null,
  merchant_id: 'm1',
  sender_email: 'alerts@bank.com',
  sender_name: 'Bank',
  subject: 'Purchase',
  email_date: '2026-06-12',
  amount: 24500,
  currency: 'SAR',
  suggested_merchant: 'Carrefour',
  suggested_category: null,
  suggested_subcategory: null,
  raw_preview: 'Amount: SAR 245.00',
  has_body: true,
  status: 'PENDING',
  created_at: '2026-06-13T00:00:00Z',
  version: 'v1',
})

describe('email-sync enum maps', () => {
  it('round-trips scan frequency through the wire', () => {
    for (const f of ['15m', 'hourly', 'daily'] as const) {
      expect(fromWireFrequency(toWireFrequency(f))).toBe(f)
    }
  })

  it('maps providers to their UPPER_SNAKE wire names', () => {
    expect(toWireProvider('google')).toBe('GOOGLE')
    expect(toWireProvider('outlook')).toBe('OUTLOOK')
  })
})

describe('email-sync wire mappers', () => {
  it('maps a connection wire to the domain shape', () => {
    const wire: ConnectionWire = {
      id: 'c1',
      provider: 'GOOGLE',
      email_address: 'khalid@example.com',
      auto_sync: true,
      auto_confirm: false,
      scan_frequency: 'FIFTEEN_MIN',
      default_wallet_id: null,
      status: 'CONNECTED',
      last_synced_at: null,
      rules: [
        {
          id: 'r1',
          sender_email: 'alerts@bank.com',
          sender_name: 'Bank',
          default_category: null,
        },
      ],
      created_at: '2026-06-13T00:00:00Z',
      updated_at: '2026-06-13T00:00:00Z',
      version: 'v1',
    }
    const c = toConnection(wire)
    expect(c.provider).toBe('google')
    expect(c.email).toBe('khalid@example.com')
    expect(c.scanFrequency).toBe('15m')
    expect(c.status).toBe('connected')
    expect(c.rules[0].senderEmail).toBe('alerts@bank.com')
  })

  it('maps an import wire (minor-unit amount + status) to the domain shape', () => {
    const i = toImport(importWire())
    expect(i.amount).toBe(24500)
    expect(i.currency).toBe('SAR')
    expect(i.status).toBe('pending')
    expect(i.suggestedMerchant).toBe('Carrefour')
    expect(i.merchantId).toBe('m1')
    expect(i.hasBody).toBe(true)
  })

  it('maps the detail wire to the import, its email body, and its merchant', () => {
    const detail = toImportDetail({
      email_import: importWire(),
      body_lines: ['Merchant: CARREFOUR', 'Amount: SAR 245.00'],
      body_truncated: false,
      merchant: {
        id: 'm1',
        display_name: 'CARREFOUR',
        learned_category: 'groceries',
        learned_subcategory: 'supermarket',
        times_seen: 3,
        times_confirmed: 2,
      },
    })
    expect(detail.import.id).toBe('i1')
    expect(detail.bodyLines).toHaveLength(2)
    expect(detail.merchant?.learnedCategory).toBe('groceries')
    expect(detail.merchant?.timesConfirmed).toBe(2)
  })

  it('maps an unparsed import — no amount, no merchant, no stored body', () => {
    const i = toImport({
      ...importWire(),
      amount: null,
      currency: null,
      merchant_id: null,
      has_body: false,
    })
    expect(i.amount).toBeNull()
    expect(i.merchantId).toBeNull()
    expect(i.hasBody).toBe(false)
  })
})
