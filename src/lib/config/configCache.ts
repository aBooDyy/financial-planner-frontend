import { db } from '#/db/db'
import { APP_CONFIG_KEY } from '#/db/types'
import type { AppConfig } from './appConfig'
import { BUNDLED_CONFIG } from './bundledConfig'

/**
 * The cached config survives reloads, so a returning user is current before any request. A
 * row cached before a field existed is filled from the bundle: the server keeps the same
 * version stamp when it only adds fields, so that row may never be replaced wholesale.
 */
export async function loadCachedConfig(): Promise<AppConfig | null> {
  try {
    const row = await db.appConfig.get(APP_CONFIG_KEY)
    if (!row) return null
    const cached: Partial<AppConfig> = row.config
    return {
      ...BUNDLED_CONFIG,
      ...cached,
      limits: { ...BUNDLED_CONFIG.limits, ...cached.limits },
      integrations: cached.integrations ?? BUNDLED_CONFIG.integrations,
    }
  } catch {
    return null
  }
}

export async function saveCachedConfig(config: AppConfig): Promise<void> {
  try {
    await db.appConfig.put({
      id: APP_CONFIG_KEY,
      config,
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    // A failed cache write costs a refetch next open, nothing more.
  }
}
