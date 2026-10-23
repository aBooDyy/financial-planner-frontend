import { describe, expect, it } from 'vitest'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import { settingsOf } from '#/features/integrations/api/types'
import { describeKey } from './describe'
import { applyEdit, draftProblems } from './draft'
import { failureMessage, keyFailure } from './errors'
import { ApiError } from '#/lib/apiError'
import { endOfDayIso, expiryDay, presetExpiry } from './expiry'
import { keyHealth } from './health'
import { byListOrder } from './mappers'
import { formatResume, presetPause, startOfDayIso } from './pause'

const NOW = new Date('2026-09-23T12:00:00Z')
const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 3600 * 1000).toISOString()

describe('keyHealth', () => {
  it('reads revoked, expired, expiring and active', () => {
    expect(keyHealth(aKey({ status: 'revoked' }), NOW)).toBe('revoked')
    expect(keyHealth(aKey({ expiresAt: inDays(-1) }), NOW)).toBe('expired')
    expect(keyHealth(aKey({ expiresAt: inDays(12) }), NOW)).toBe('expiring')
    expect(keyHealth(aKey({ expiresAt: inDays(40) }), NOW)).toBe('active')
    expect(keyHealth(aKey(), NOW)).toBe('active')
  })

  it('reads a key paused until later as paused, and as itself once that passes', () => {
    expect(keyHealth(aKey({ pausedUntil: inDays(1) }), NOW)).toBe('paused')
    expect(keyHealth(aKey({ pausedUntil: inDays(-1) }), NOW)).toBe('active')
  })

  it('reads a row cached before pauses existed as unpaused', () => {
    const { pausedUntil: _, ...cached } = aKey()
    expect(keyHealth(cached as ReturnType<typeof aKey>, NOW)).toBe('active')
  })

  it('reports revocation and expiry over a pause', () => {
    const paused = { pausedUntil: inDays(1) }
    expect(keyHealth(aKey({ ...paused, status: 'revoked' }), NOW)).toBe(
      'revoked',
    )
    expect(keyHealth(aKey({ ...paused, expiresAt: inDays(-1) }), NOW)).toBe(
      'expired',
    )
  })

  it('treats a revoked key as revoked even once it has expired', () => {
    expect(
      keyHealth(aKey({ status: 'revoked', expiresAt: inDays(-3) }), NOW),
    ).toBe('revoked')
  })
})

describe('describeKey', () => {
  const ctx = { locale: 'en', dateFormat: 'dmy' as const, now: NOW }

  it('names the account, the expiry and the last use in plain words', () => {
    const parts = describeKey(
      aKey({ expiresAt: inDays(12), lastUsedAt: inDays(-2) }),
      { ...ctx, walletName: 'Visa (main)' },
    )
    expect(parts).toEqual([
      'Active',
      'Visa (main)',
      'expires in 12 days',
      'last used 2 days ago',
    ])
  })

  it('says until when a paused key is paused', () => {
    const [line] = describeKey(aKey({ pausedUntil: '2026-09-30T09:00:00Z' }), {
      ...ctx,
      walletName: null,
    })
    expect(line).toMatch(/^Paused until 30\/09\/2026, /)
  })

  it('says a revoked key’s history, not its settings', () => {
    expect(
      describeKey(aKey({ status: 'revoked', requestsCount: 412 }), {
        ...ctx,
        walletName: 'Visa',
      }),
    ).toEqual(['Revoked', '412 requests'])
  })

  it('explains an expired key', () => {
    const [line] = describeKey(aKey({ expiresAt: '2026-08-03T10:00:00Z' }), {
      ...ctx,
      walletName: null,
    })
    expect(line).toBe(
      'Expired 03/08/2026 — this key no longer accepts transactions',
    )
  })
})

describe('the key draft', () => {
  const base = settingsOf({ ...aKey(), defaultWalletId: 'w1' })

  it('drops the default category when the type changes', () => {
    const withCategory = { ...base, defaultCategoryId: 'cat-dining-cafes' }
    expect(
      applyEdit(withCategory, 'defaultCategoryId', 'cat-transport'),
    ).toMatchObject({ defaultCategoryId: 'cat-transport' })
    expect(applyEdit(withCategory, 'defaultType', 'income')).toMatchObject({
      defaultCategoryId: null,
    })
    expect(
      applyEdit(withCategory, 'defaultType', 'spend').defaultCategoryId,
    ).toBe('cat-dining-cafes')
  })

  it('turns posting without review off when the account is cleared', () => {
    const posting = { ...base, autoConfirm: true }
    expect(applyEdit(posting, 'defaultWalletId', null).autoConfirm).toBe(false)
  })

  it('flags a blank name, an out-of-range rate limit and auto-confirm without an account', () => {
    expect(draftProblems(base)).toEqual({})
    const problems = draftProblems({
      ...base,
      name: '  ',
      rateLimitPerMinute: 601,
      autoConfirm: true,
      defaultWalletId: null,
    })
    expect(Object.keys(problems).sort()).toEqual([
      'autoConfirm',
      'name',
      'rateLimitPerMinute',
    ])
  })
})

describe('keyFailure', () => {
  it('puts a field error beside its field, and anything else on the key', () => {
    expect(keyFailure({ code: 'integrations.key.name_taken' })).toEqual({
      fields: { name: 'You already have a key with that name.' },
      general: null,
    })
    expect(keyFailure({ code: 'integrations.key.limit_reached' })).toEqual({
      fields: {},
      general:
        'You’ve reached the most keys you can have. Delete one you no longer use.',
    })
  })

  it('places every field a 422 names', () => {
    const failure = keyFailure(
      new ApiError({
        code: 'integrations.key.expiry_invalid',
        message: '',
        status: 422,
        details: [
          { field: 'expires_at', code: 'integrations.key.expiry_invalid' },
          {
            field: 'rate_limit_per_minute',
            code: 'integrations.key.rate_limit_invalid',
          },
        ],
      }),
    )
    expect(Object.keys(failure.fields).sort()).toEqual([
      'expiresAt',
      'rateLimitPerMinute',
    ])
    expect(failureMessage(failure, ['expiresAt'])).toBe(
      'Set a rate limit between 1 and 600 requests a minute.',
    )
  })
})

describe('expiry', () => {
  it('ends on the last second of the chosen local day', () => {
    const iso = endOfDayIso('2026-12-31')
    const d = new Date(iso)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 11, 31, 23,
    ])
    expect(expiryDay(iso)).toBe('2026-12-31')
  })

  it('counts presets from today', () => {
    expect(expiryDay(presetExpiry('30d', new Date(2026, 8, 23)))).toBe(
      '2026-10-23',
    )
  })
})

describe('pause', () => {
  it('counts presets from now', () => {
    expect(presetPause('1h', NOW)).toBe('2026-09-23T13:00:00.000Z')
    expect(presetPause('7d', NOW)).toBe('2026-09-30T12:00:00.000Z')
  })

  it('resumes at the start of the chosen local day', () => {
    const d = new Date(startOfDayIso('2026-10-05'))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 9, 5, 0,
    ])
  })

  it('shows only the time for a pause that ends today', () => {
    const later = new Date(NOW.getTime() + 3600 * 1000).toISOString()
    expect(formatResume(later, 'en', 'dmy', NOW)).not.toContain('/')
  })
})

describe('list order', () => {
  it('puts active keys first, newest first within each', () => {
    const keys = [
      aKey({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      aKey({
        id: 'gone',
        status: 'revoked',
        createdAt: '2026-09-01T00:00:00Z',
      }),
      aKey({ id: 'new', createdAt: '2026-06-01T00:00:00Z' }),
    ]
    expect(keys.sort(byListOrder).map((k) => k.id)).toEqual([
      'new',
      'old',
      'gone',
    ])
  })
})
