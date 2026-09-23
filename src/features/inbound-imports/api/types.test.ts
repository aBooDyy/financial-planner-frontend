import { describe, expect, it } from 'vitest'
import type { InboundImportWire } from './types'
import { toImportDetail, toInboundImport } from './types'

const importWire = (): InboundImportWire => ({
  id: 'i1',
  source: 'INBOX',
  connection_id: 'c1',
  integration_key_id: null,
  rule_id: 'r1',
  transaction_id: null,
  merchant_id: 'm1',
  source_ref: 'alerts@bank.com',
  source_label: 'Bank',
  subject: 'Purchase',
  occurred_on: '2026-06-12',
  amount: 24500,
  currency: 'SAR',
  suggested_merchant: 'Carrefour',
  suggested_category: null,
  suggested_subcategory: null,
  suggested_type: null,
  suggested_wallet_id: null,
  raw_preview: 'Amount: SAR 245.00',
  has_body: true,
  body_format: 'TEXT',
  status: 'PENDING',
  created_at: '2026-06-13T00:00:00Z',
  version: 'v1',
})

describe('inbound-import wire mappers', () => {
  it('maps an inbox import (minor-unit amount, lowercase enums) to the domain shape', () => {
    const i = toInboundImport(importWire())
    expect(i.source).toBe('inbox')
    expect(i.connectionId).toBe('c1')
    expect(i.keyId).toBeNull()
    expect(i.sourceRef).toBe('alerts@bank.com')
    expect(i.sourceLabel).toBe('Bank')
    expect(i.occurredOn).toBe('2026-06-12')
    expect(i.amount).toBe(24500)
    expect(i.currency).toBe('SAR')
    expect(i.status).toBe('pending')
    expect(i.bodyFormat).toBe('text')
    expect(i.suggestedMerchant).toBe('Carrefour')
    expect(i.merchantId).toBe('m1')
    expect(i.hasBody).toBe(true)
  })

  it('maps a webhook import: a key instead of a connection, a JSON body', () => {
    const i = toInboundImport({
      ...importWire(),
      source: 'WEBHOOK',
      connection_id: null,
      integration_key_id: 'k1',
      source_ref: 'fpk_7f3a9c21',
      source_label: 'Tasker — SMS alerts',
      body_format: 'JSON',
    })
    expect(i.source).toBe('webhook')
    expect(i.connectionId).toBeNull()
    expect(i.keyId).toBe('k1')
    expect(i.bodyFormat).toBe('json')
  })

  it('maps the type and wallet the source suggested, lowercasing the type', () => {
    const i = toInboundImport({
      ...importWire(),
      suggested_type: 'INCOME',
      suggested_wallet_id: 'w9',
    })
    expect(i.suggestedType).toBe('income')
    expect(i.suggestedWalletId).toBe('w9')
    expect(toInboundImport(importWire()).suggestedType).toBeNull()
  })

  it('maps the detail wire to the import, its body, and its merchant', () => {
    const detail = toImportDetail({
      inbound_import: importWire(),
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
    const i = toInboundImport({
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
