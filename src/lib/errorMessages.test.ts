import { describe, expect, it } from 'vitest'
import { messageForCode } from './errorMessages'

const FALLBACK = 'Something went wrong. Please try again.'

const INTEGRATION_CODES = [
  'integrations.key.not_found',
  'integrations.key.name_required',
  'integrations.key.name_taken',
  'integrations.key.expiry_invalid',
  'integrations.key.wallet_invalid',
  'integrations.key.currency_invalid',
  'integrations.key.rate_limit_invalid',
  'integrations.key.auto_confirm_needs_wallet',
  'integrations.key.limit_reached',
  'integrations.key.revoked',
  'integrations.rule.invalid',
  'integrations.rule.path_invalid',
  'integrations.rule.regex_invalid',
  'integrations.rule.field_unknown',
  'integrations.rule.limit_reached',
  'integrations.auth.missing',
  'integrations.auth.invalid',
  'integrations.auth.expired',
  'integrations.auth.revoked',
  'integrations.payload.invalid',
  'integrations.payload.too_large',
  'integrations.rate.limited',
]

describe('error messages', () => {
  it.each(INTEGRATION_CODES)('has a message for %s', (code) => {
    expect(messageForCode(code)).not.toBe(FALLBACK)
  })

  it('falls back for a code it does not know', () => {
    expect(messageForCode('nope.nothing')).toBe(FALLBACK)
  })
})
