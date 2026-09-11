import { db } from '#/db/db'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import { connectionToLocal, importToLocal } from './mappers'

/**
 * Refresh the local read cache from server truth. Email-sync rows are server-owned, so a pull
 * simply replaces the cached set (no dirty-local reconciliation like the offline features).
 */
export async function pullConnections(): Promise<void> {
  const connections = await emailSyncApi.listConnections()
  await db.transaction('rw', db.emailConnections, async () => {
    await db.emailConnections.clear()
    await db.emailConnections.bulkPut(connections.map(connectionToLocal))
  })
}

export async function pullPendingImports(): Promise<void> {
  const imports = await emailSyncApi.listImports('pending')
  await db.transaction('rw', db.emailImports, async () => {
    await db.emailImports.clear()
    await db.emailImports.bulkPut(imports.map(importToLocal))
  })
}
