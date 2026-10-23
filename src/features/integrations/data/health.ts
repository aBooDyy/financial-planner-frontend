import type { LocalIntegrationKey } from '#/db/types'

/** What a key's status dot and label say. Only `active` and `revoked` are stored. */
export type KeyHealth = 'active' | 'expiring' | 'paused' | 'expired' | 'revoked'

const DAY_MS = 24 * 3600 * 1000
const EXPIRY_WARNING_DAYS = 14

export function keyHealth(
  key: Pick<LocalIntegrationKey, 'status' | 'expiresAt' | 'pausedUntil'>,
  now: Date = new Date(),
): KeyHealth {
  if (key.status === 'revoked') return 'revoked'
  const left =
    key.expiresAt === null
      ? Infinity
      : new Date(key.expiresAt).getTime() - now.getTime()
  if (left <= 0) return 'expired'
  if (isPaused(key, now)) return 'paused'
  return left <= EXPIRY_WARNING_DAYS * DAY_MS ? 'expiring' : 'active'
}

/** A row cached before pauses existed has no `pausedUntil` at all. */
export const isPaused = (
  key: Pick<LocalIntegrationKey, 'pausedUntil'>,
  now: Date = new Date(),
): boolean =>
  !!key.pausedUntil && new Date(key.pausedUntil).getTime() > now.getTime()

export const HEALTH_LABEL: Record<KeyHealth, string> = {
  active: 'Active',
  expiring: 'Active',
  paused: 'Paused',
  expired: 'Expired',
  revoked: 'Revoked',
}
