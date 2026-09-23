import type { LocalIntegrationKey } from '#/db/types'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { keyHealth } from './health'
import type { KeyHealth } from './health'

export const keyToLocal = (k: IntegrationKey): LocalIntegrationKey => ({
  ...k,
})

const RANK: Record<KeyHealth, number> = {
  active: 0,
  expiring: 0,
  expired: 1,
  revoked: 2,
}

/** Working keys first, then expired, then revoked; newest first within each. */
export const byListOrder = (
  a: LocalIntegrationKey,
  b: LocalIntegrationKey,
): number =>
  RANK[keyHealth(a)] - RANK[keyHealth(b)] ||
  b.createdAt.localeCompare(a.createdAt)
