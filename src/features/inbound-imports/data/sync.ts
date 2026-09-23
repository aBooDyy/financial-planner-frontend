import { db, localDbGeneration } from '#/db/db'
import { pullDelta } from '#/db/delta'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { InboundImport } from '#/features/inbound-imports/api/types'
import { pullPendingImports } from './cache'
import { importToLocal } from './mappers'

/**
 * The incremental pull for the review queue. These rows are a server-owned read cache — no
 * outbox, no dirty flag — so an apply is a plain upsert by id.
 *
 * The delta carries every status while the cache answers only "what is waiting for
 * review", so an import confirmed or dismissed anywhere leaves the cache. That is also how
 * this device learns another one acted on it, which the pending-only list could never say.
 */
async function applyImportChanges(
  generation: number,
  items: ReadonlyArray<InboundImport>,
  deletedIds: ReadonlyArray<string>,
): Promise<void> {
  await db.transaction('rw', db.inboundImports, async () => {
    // Signed out while the page was on its way: these rows belong to the previous user.
    if (localDbGeneration() !== generation) return
    for (const item of items) {
      if (item.status === 'pending') {
        await db.inboundImports.put(importToLocal(item))
      } else {
        await db.inboundImports.delete(item.id)
      }
    }
    await db.inboundImports.bulkDelete([...deletedIds])
  })
}

const runPull = (): Promise<void> => {
  const generation = localDbGeneration()
  return pullDelta<InboundImport>({
    entity: 'inboundImport',
    fetchChanges: inboundImportsApi.importChanges,
    apply: (items, deletedIds) =>
      applyImportChanges(generation, items, deletedIds),
    idOf: (item) => item.id,
    fullPull: pullPendingImports,
    reconcile: async (delivered) => {
      await db.transaction('rw', db.inboundImports, async () => {
        const stale = (await db.inboundImports.toArray())
          .filter((row) => !delivered.has(row.id))
          .map((row) => row.id)
        await db.inboundImports.bulkDelete(stale)
      })
    },
  })
}

let inFlight: Promise<void> | null = null

/**
 * Pull the queue's changes. Several triggers reach this — the app-wide pull loop, a scan,
 * opening the review — so a call made while one is running joins it instead of racing it.
 */
export function pullInboundImportsDelta(): Promise<void> {
  inFlight ??= runPull().finally(() => {
    inFlight = null
  })
  return inFlight
}
