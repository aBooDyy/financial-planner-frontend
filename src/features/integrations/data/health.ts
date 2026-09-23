import type { LocalIntegrationKey } from '#/db/types'

/** What a key's status dot and label say. Only `active` and `revoked` are stored. */
export type KeyHealth = 'active' | 'expiring' | 'expired' | 'revoked'

const DAY_MS = 24 * 3600 * 1000
const EXPIRY_WARNING_DAYS = 14

export function keyHealth(
  key: Pick<LocalIntegrationKey, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): KeyHealth {
  if (key.status === 'revoked') return 'revoked'
  if (key.expiresAt === null) return 'active'
  const left = new Date(key.expiresAt).getTime() - now.getTime()
  if (left <= 0) return 'expired'
  return left <= EXPIRY_WARNING_DAYS * DAY_MS ? 'expiring' : 'active'
}

export const HEALTH_LABEL: Record<KeyHealth, string> = {
  active: 'Active',
  expiring: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
}
