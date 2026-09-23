import type {
  Delivery,
  DeliveryWire,
} from '#/features/integrations/api/deliveryTypes'
import type { Extraction } from '#/features/integrations/api/ruleTypes'

export const PURCHASE_PAYLOAD = '{"event":"purchase","amount":"152.75"}'

const anExtraction = (over: Partial<Extraction> = {}): Extraction => ({
  fields: {
    amount: { value: null, raw: null, status: 'PATH_NOT_FOUND' },
    merchant: {
      value: null,
      raw: 'Purchase at CARREFOUR',
      status: 'REGEX_NO_MATCH',
    },
  },
  values: {
    date: '2026-09-23',
    type: 'SPEND',
    amount: null,
    currency: 'SAR',
    merchant: null,
    category: null,
    subcategory: null,
    note: null,
    externalId: null,
    wallet: null,
  },
  missing: ['amount'],
  resolved: { walletId: null, category: null, subcategory: null },
  ...over,
})

export const aDelivery = (over: Partial<Delivery> = {}): Delivery => ({
  id: 'd1',
  receivedAt: '2026-09-23T10:02:00Z',
  outcome: 'STAGED',
  statusCode: 201,
  errorCode: null,
  ruleId: 'r1',
  ruleName: 'Purchase',
  importId: 'imp1',
  payloadExcerpt: PURCHASE_PAYLOAD,
  payloadTruncated: false,
  report: {
    trace: [
      { index: 0, ruleId: 'r1', name: 'Purchase', matched: true, detail: null },
    ],
    result: anExtraction(),
  },
  ...over,
})

export const aRejection = (errorCode: string): Delivery =>
  aDelivery({
    id: `rejected-${errorCode}`,
    outcome: 'REJECTED',
    statusCode: 401,
    errorCode,
    ruleId: null,
    ruleName: null,
    importId: null,
    payloadExcerpt: null,
    report: null,
  })

export const aDeliveryWire = (
  over: Partial<DeliveryWire> = {},
): DeliveryWire => ({
  id: 'd1',
  received_at: '2026-09-23T10:02:00Z',
  outcome: 'IGNORED',
  status_code: 200,
  error_code: null,
  rule_id: null,
  rule_name: null,
  import_id: null,
  payload_excerpt: PURCHASE_PAYLOAD,
  payload_truncated: false,
  report: {
    trace: [
      {
        index: 0,
        rule_id: 'r1',
        name: 'Refund',
        matched: false,
        reason: 'MATCH_FAILED',
        detail: '$.event is "purchase"',
      },
    ],
    result: {
      fields: {},
      values: {
        date: '2026-09-23',
        type: 'SPEND',
        amount: null,
        currency: null,
        merchant: null,
        category: null,
        subcategory: null,
        note: null,
        external_id: 'evt_1',
        wallet: null,
      },
      missing: ['amount', 'currency'],
      resolved: { wallet_id: null, category: null, subcategory: null },
    },
  },
  ...over,
})
