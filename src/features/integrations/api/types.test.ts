import { describe, expect, it } from 'vitest'
import { aKeyWire } from '#/features/integrations/__fixtures__/keys'
import {
  settingsOf,
  toCreateKeyWire,
  toCreatedKey,
  toIntegrationKey,
  toUpdateKeyWire,
} from './types'

describe('integration key wire mappers', () => {
  it('maps a key to the domain shape with lowercase enums', () => {
    const key = toIntegrationKey(aKeyWire())
    expect(key).toMatchObject({
      id: 'k1',
      tokenPrefix: 'fpk_7f3a9c21',
      status: 'active',
      lastUsedAt: '2026-09-23T10:02:00Z',
      requestsCount: 412,
      defaultWalletId: 'w1',
      defaultCategory: 'groceries',
      defaultType: 'spend',
      defaultCurrency: 'SAR',
      stageUnmatched: true,
      ruleCount: 2,
      version: 'sha-1',
    })
    expect(toIntegrationKey(aKeyWire({ status: 'REVOKED' })).status).toBe(
      'revoked',
    )
  })

  it('never stores EXPIRED — it is re-derived from the expiry', () => {
    const key = toIntegrationKey(
      aKeyWire({ status: 'EXPIRED', expires_at: '2026-08-03T10:00:00Z' }),
    )
    expect(key.status).toBe('active')
    expect(toUpdateKeyWire(key.version, settingsOf(key)).status).toBe('ACTIVE')
  })

  it('keeps the token only on the created shape', () => {
    const created = toCreatedKey({
      key: aKeyWire(),
      token: 'fpk_7f3a9c21.s3cr3t',
    })
    expect(created.token).toBe('fpk_7f3a9c21.s3cr3t')
    expect(JSON.stringify(created.key)).not.toContain('s3cr3t')
  })

  it('sends a create with snake_case keys', () => {
    expect(
      toCreateKeyWire({
        name: 'n8n',
        expiresAt: '2026-12-31T20:59:59.000Z',
        defaultWalletId: null,
      }),
    ).toEqual({
      name: 'n8n',
      expires_at: '2026-12-31T20:59:59.000Z',
      default_wallet_id: null,
    })
  })

  it('round-trips a key’s settings into a full, version-checked update', () => {
    const key = toIntegrationKey(aKeyWire())
    const wire = toUpdateKeyWire(key.version, {
      ...settingsOf(key),
      status: 'revoked',
      defaultType: 'income',
    })
    expect(wire).toEqual({
      version: 'sha-1',
      name: 'Tasker — SMS alerts',
      status: 'REVOKED',
      expires_at: null,
      default_wallet_id: 'w1',
      default_category: 'groceries',
      default_subcategory: null,
      default_type: 'INCOME',
      default_currency: 'SAR',
      auto_confirm: false,
      stage_unmatched: true,
      rate_limit_per_minute: 60,
    })
  })
})
