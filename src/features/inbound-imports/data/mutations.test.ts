import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type {
  ConfirmResultWire,
  InboundImport,
  InboundImportWire,
} from '#/features/inbound-imports/api/types'
import { http } from '#/lib/http'
import { confirmImport } from './mutations'

afterEach(() => vi.restoreAllMocks())

const importWire: InboundImportWire = {
  id: 'i1',
  source: 'INBOX',
  connection_id: 'c1',
  integration_key_id: null,
  rule_id: null,
  transaction_id: 't1',
  merchant_id: null,
  source_ref: null,
  source_label: null,
  subject: null,
  occurred_on: '2026-09-01',
  amount: 4200,
  currency: 'SAR',
  suggested_merchant: null,
  suggested_category_id: null,
  suggested_type: null,
  suggested_wallet_id: null,
  raw_preview: null,
  has_body: false,
  body_format: 'TEXT',
  status: 'CONFIRMED',
  created_at: '2026-09-01T00:00:00Z',
  version: 'v2',
}

const confirmed: ConfirmResultWire = {
  transaction: {
    id: 't1',
    type: 'SPEND',
    amount: 4200,
    currency: 'SAR',
    category_id: 'cat-dining-cafes',
    wallet_id: 'w1',
    goal_id: null,
    merchant_id: null,
    date: '2026-09-01',
    note: null,
    source: 'email:c1',
    transfer_id: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 'tx-v1',
  },
  inbound_import: importWire,
}

it('confirms with the leaf category id and files the promoted entry locally', async () => {
  const post = vi.spyOn(http, 'post').mockResolvedValue(confirmed)
  await confirmImport({ id: 'i1' } as InboundImport, {
    walletId: 'w1',
    categoryId: 'cat-dining-cafes',
    type: 'spend',
    amount: 4200,
  })

  expect(post).toHaveBeenCalledWith('/inbound-imports/i1/confirm', {
    wallet_id: 'w1',
    category_id: 'cat-dining-cafes',
    type: 'SPEND',
    amount: 4200,
  })
  const row = await db.transactions.get('t1')
  expect(row?.categoryId).toBe('cat-dining-cafes')
})
