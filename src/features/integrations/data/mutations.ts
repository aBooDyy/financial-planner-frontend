import { integrationKeysApi } from '#/features/integrations/api/integrationKeysApi'
import type {
  CreatedKey,
  IntegrationKey,
  KeySettings,
  NewKey,
} from '#/features/integrations/api/types'
import { settingsOf } from '#/features/integrations/api/types'
import { cacheKey, uncacheKey } from './cache'

/** The token is handed back to the caller and never stored — it is shown once, then gone. */
export async function createKey(draft: NewKey): Promise<CreatedKey> {
  const created = await integrationKeysApi.create(draft)
  await cacheKey(created.key)
  return created
}

export async function updateKey(
  key: IntegrationKey,
  settings: KeySettings,
): Promise<IntegrationKey> {
  const updated = await integrationKeysApi.update(key.id, key.version, settings)
  await cacheKey(updated)
  return updated
}

export async function revokeKey(key: IntegrationKey): Promise<IntegrationKey> {
  return updateKey(key, { ...settingsOf(key), status: 'revoked' })
}

export async function rotateKey(key: IntegrationKey): Promise<CreatedKey> {
  const rotated = await integrationKeysApi.rotate(key.id)
  await cacheKey(rotated.key)
  return rotated
}

export async function deleteKey(id: string): Promise<void> {
  await integrationKeysApi.remove(id)
  await uncacheKey(id)
}
