import { db, localDbGeneration } from '#/db/db'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import { importToLocal } from './mappers'

/** Replace the cached queue with the server's pending list — the delta's full-sync fallback. */
export async function pullPendingImports(): Promise<void> {
  const seen = localDbGeneration()
  const imports = await inboundImportsApi.listImports('pending')
  await db.transaction('rw', db.inboundImports, async () => {
    // Signed out while the list was on its way: these rows belong to the previous user.
    if (localDbGeneration() !== seen) return
    await db.inboundImports.clear()
    await db.inboundImports.bulkPut(imports.map(importToLocal))
  })
}

/** The server cascades an inbox's imports away on disconnect; mirror that locally. */
export async function dropConnectionImports(
  connectionId: string,
): Promise<void> {
  await db.inboundImports.where('connectionId').equals(connectionId).delete()
}
