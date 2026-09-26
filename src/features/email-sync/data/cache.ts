import { db, localDbGeneration } from '#/db/db'
import type { EmailRuleSummary } from '#/db/types'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type { EmailConnection } from '#/features/email-sync/api/types'
import { connectionToLocal } from './mappers'

/** Bumped by every write a mutation makes, so a refresh can tell it was overtaken. */
let writes = 0

const generation = (): string => `${localDbGeneration()}:${writes}`

/**
 * Replace the cached connections with server truth. A list that left the server before a
 * connect, save or disconnect landed here would undo it, and one that left before sign-out
 * wiped the cache would hand the previous user's inboxes to the next, so such a list is dropped.
 */
export async function pullConnections(): Promise<void> {
  const seen = generation()
  const connections = await emailSyncApi.listConnections()
  await db.transaction('rw', db.emailConnections, async () => {
    if (generation() !== seen) return
    await db.emailConnections.clear()
    await db.emailConnections.bulkPut(connections.map(connectionToLocal))
  })
}

export async function cacheConnection(
  connection: EmailConnection,
): Promise<void> {
  writes += 1
  await db.emailConnections.put(connectionToLocal(connection))
}

export async function uncacheConnection(id: string): Promise<void> {
  writes += 1
  await db.emailConnections.delete(id)
}

/** A rules save changes what the list shows without touching the connection's version. */
export async function recordRuleSummaries(
  id: string,
  rules: EmailRuleSummary[],
): Promise<void> {
  writes += 1
  await db.emailConnections.update(id, { rules })
}
