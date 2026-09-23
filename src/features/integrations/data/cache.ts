import { db, localDbGeneration } from '#/db/db'
import { integrationKeysApi } from '#/features/integrations/api/integrationKeysApi'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { keyToLocal } from './mappers'

/** Bumped by every write a mutation makes, so a refresh can tell it was overtaken. */
let writes = 0

const generation = (): string => `${localDbGeneration()}:${writes}`

/**
 * Replace the cached keys with server truth. A list that left the server before a create,
 * rotate or delete landed here would undo it, and one that left before sign-out wiped the
 * cache would hand the previous user's keys to the next, so such a list is dropped.
 */
export async function pullIntegrationKeys(): Promise<void> {
  const seen = generation()
  const keys = await integrationKeysApi.list()
  await db.transaction('rw', db.integrationKeys, async () => {
    if (generation() !== seen) return
    await db.integrationKeys.clear()
    await db.integrationKeys.bulkPut(keys.map(keyToLocal))
  })
}

export async function cacheKey(key: IntegrationKey): Promise<void> {
  writes += 1
  await db.integrationKeys.put(keyToLocal(key))
}

export async function uncacheKey(id: string): Promise<void> {
  writes += 1
  await db.integrationKeys.delete(id)
}

/** A rules save moves the key's count without touching its settings or version. */
export async function recordRuleCount(
  id: string,
  ruleCount: number,
): Promise<void> {
  writes += 1
  await db.integrationKeys.update(id, { ruleCount })
}
