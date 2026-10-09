import { describe, expect, it } from 'vitest'
import type { Passkey } from '#/features/passkeys/api/types'
import { addedLine, deviceLine, lastUsedLine } from './describe'

const passkey = (over: Partial<Passkey> = {}): Passkey => ({
  id: 'p1',
  name: 'iPhone · Safari',
  providerName: 'iCloud Keychain',
  deviceType: 'mobile',
  deviceModel: 'iPhone',
  osName: 'iOS',
  osVersion: '18.1',
  browserName: 'Mobile Safari',
  browserVersion: '18.1',
  backedUp: true,
  backupEligible: true,
  transports: ['internal', 'hybrid'],
  createdAt: '2026-06-16T10:00:00Z',
  lastUsedAt: null,
  lastUsedDevice: null,
  updatedAt: '2026-06-16T10:00:00Z',
  version: 'v1',
  ...over,
})

const NOW = new Date('2026-10-09T12:00:00Z')

describe('deviceLine', () => {
  it('reads device, system and browser', () => {
    expect(deviceLine(passkey())).toBe('iPhone · iOS 18.1 · Safari')
  })

  it('leaves out what the server could not tell', () => {
    expect(
      deviceLine(
        passkey({ deviceModel: null, osVersion: null, browserName: 'Chrome' }),
      ),
    ).toBe('iOS · Chrome')
    expect(
      deviceLine(
        passkey({ deviceModel: null, osName: null, browserName: null }),
      ),
    ).toBeNull()
  })
})

describe('addedLine', () => {
  it('follows the date format preference', () => {
    expect(addedLine(passkey(), 'dmy')).toBe('Added 16/06/2026')
    expect(addedLine(passkey(), 'ymd')).toBe('Added 2026-06-16')
  })
})

describe('lastUsedLine', () => {
  it('says a passkey was never used', () => {
    expect(lastUsedLine(passkey(), 'en', NOW)).toBe('Never used')
  })

  it('says when and on what it was last used', () => {
    expect(
      lastUsedLine(
        passkey({
          lastUsedAt: '2026-10-06T12:00:00Z',
          lastUsedDevice: 'Mac · Chrome',
        }),
        'en',
        NOW,
      ),
    ).toBe('Last used 3 days ago on Mac · Chrome')
  })

  it('leaves the device out when the server has none', () => {
    expect(
      lastUsedLine(passkey({ lastUsedAt: '2026-10-08T12:00:00Z' }), 'en', NOW),
    ).toBe('Last used yesterday')
  })
})
