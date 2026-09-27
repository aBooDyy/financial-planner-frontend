// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalInboundImport } from '#/db/types'
import {
  PURCHASE_PAYLOAD,
  aDelivery,
  aDeliveryWire,
  aRejection,
} from '#/features/integrations/__fixtures__/deliveries'
import { toDelivery } from '#/features/integrations/api/deliveryTypes'
import { canBuildFrom, summarizeDelivery } from './deliveryText'
import { deliveryPayload, lastPayload } from './lastPayload'
import { throttleNotice } from './throttle'

const list = vi.fn()
const getImport = vi.fn()

vi.mock('#/features/integrations/api/integrationDeliveriesApi', () => ({
  integrationDeliveriesApi: { list: (id: string) => list(id) },
}))
vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: { getImport: (id: string) => getImport(id) },
}))

const LIMITS = { rateLimitPerMinute: 60, payloadMaxBytes: 65536 }

beforeEach(async () => {
  list.mockReset()
  getImport.mockReset()
  await db.inboundImports.clear()
})

describe('toDelivery', () => {
  it('maps the wire, the trace and the field report', () => {
    const delivery = toDelivery(aDeliveryWire())
    expect(delivery).toMatchObject({
      receivedAt: '2026-09-23T10:02:00Z',
      outcome: 'IGNORED',
      payloadExcerpt: PURCHASE_PAYLOAD,
    })
    expect(delivery.report?.trace[0]).toEqual({
      index: 0,
      ruleId: 'r1',
      name: 'Refund',
      matched: false,
      detail: '$.event is "purchase"',
    })
    expect(delivery.report?.result.values.externalId).toBe('evt_1')
    expect(delivery.report?.result.resolved.walletId).toBeNull()
  })

  it('keeps a refusal that has no report', () => {
    expect(toDelivery(aDeliveryWire({ report: null })).report).toBeNull()
  })
})

describe('summarizeDelivery', () => {
  it('says a wrong secret was refused and how to fix it', () => {
    const summary = summarizeDelivery(
      aRejection('integrations.auth.invalid'),
      LIMITS,
    )
    expect(summary.tone).toBe('error')
    expect(summary.headline).toBe('Refused — wrong secret')
    expect(summary.help).toMatch(/Copy the key into your app again/)
  })

  it('names the rate limit a throttled request ran into', () => {
    const summary = summarizeDelivery(
      aRejection('integrations.rate.limited'),
      LIMITS,
    )
    expect(summary.help).toMatch(/More than 60 requests/)
  })

  it('flags a staged delivery whose rule left fields unread', () => {
    expect(summarizeDelivery(aDelivery(), LIMITS)).toMatchObject({
      tone: 'warn',
      headline: 'Waiting for review — some fields weren’t found',
    })
  })

  it('tells an unmatched staged delivery from an ignored one', () => {
    expect(
      summarizeDelivery(aDelivery({ ruleId: null }), LIMITS).headline,
    ).toBe('No rule matched — waiting for review')
    expect(
      summarizeDelivery(aDelivery({ outcome: 'IGNORED' }), LIMITS).headline,
    ).toBe('No rule matched — nothing kept')
  })

  it('says a skipped delivery was one the user marked as not a transaction', () => {
    expect(
      summarizeDelivery(aDelivery({ outcome: 'SKIPPED' }), LIMITS),
    ).toMatchObject({
      tone: 'idle',
      headline: 'Skipped — you marked one like it as not a transaction',
    })
  })
})

describe('building a rule from a delivery', () => {
  it('uses the excerpt when it is the whole object', async () => {
    expect(await deliveryPayload(aDelivery())).toBe(PURCHASE_PAYLOAD)
    expect(getImport).not.toHaveBeenCalled()
  })

  it('reads the staged import when the excerpt was cut short', async () => {
    getImport.mockResolvedValue({ bodyLines: ['{"whole":true}'] })
    const cut = aDelivery({
      payloadExcerpt: '{"whole":tr',
      payloadTruncated: true,
    })
    expect(await deliveryPayload(cut)).toBe('{"whole":true}')
    expect(getImport).toHaveBeenCalledWith('imp1')
  })

  it('has nothing to build from when no JSON object was kept', async () => {
    const refused = aRejection('integrations.payload.invalid')
    const withText = { ...refused, payloadExcerpt: '{not json' }
    expect(canBuildFrom(refused)).toBe(false)
    expect(canBuildFrom(withText)).toBe(false)
    expect(await deliveryPayload(withText)).toBeNull()
  })
})

describe('lastPayload', () => {
  it('prefers the newest delivery a rule could read', async () => {
    list.mockResolvedValue([
      aRejection('integrations.auth.invalid'),
      aDelivery({ payloadExcerpt: '{"newest":1}' }),
      aDelivery({ id: 'd0', payloadExcerpt: '{"older":1}' }),
    ])
    expect(await lastPayload('k1')).toBe('{"newest":1}')
    expect(list).toHaveBeenCalledWith('k1')
  })

  it('falls back to the newest staged import when the log has nothing', async () => {
    list.mockResolvedValue([aRejection('integrations.auth.invalid')])
    await db.inboundImports.put({
      id: 'imp9',
      keyId: 'k1',
      hasBody: true,
      createdAt: '2026-09-23T10:00:00Z',
    } as LocalInboundImport)
    getImport.mockResolvedValue({ bodyLines: ['{"staged":1}'] })

    expect(await lastPayload('k1')).toBe('{"staged":1}')
  })
})

describe('throttleNotice', () => {
  const now = new Date('2026-09-23T10:00:00Z')

  it('says when a throttled key accepts requests again', () => {
    const notice = throttleNotice(
      { throttledUntil: '2026-09-23T10:00:40Z', rateLimitPerMinute: 60 },
      'en-US',
      now,
    )
    expect(notice).toBe(
      'Over its limit of 60 a minute — requests are refused, accepted again in 40 seconds.',
    )
  })

  it('is silent once the window has rolled, or when never throttled', () => {
    expect(
      throttleNotice(
        { throttledUntil: '2026-09-23T09:59:59Z', rateLimitPerMinute: 60 },
        'en-US',
        now,
      ),
    ).toBeNull()
    expect(
      throttleNotice({ throttledUntil: null, rateLimitPerMinute: 60 }, 'en-US'),
    ).toBeNull()
  })
})
