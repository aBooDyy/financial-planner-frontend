let pending: Promise<boolean> | null = null

/**
 * Asks the browser to exempt this origin's storage from eviction under pressure, which is
 * where the local database and its unsynced outbox live. Best-effort and asked at most once
 * per page load: browsers may decline, or grant it later on their own heuristics.
 */
export function requestPersistentStorage(): Promise<boolean> {
  pending ??= ask()
  return pending
}

async function ask(): Promise<boolean> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.persist) return false
  try {
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}
