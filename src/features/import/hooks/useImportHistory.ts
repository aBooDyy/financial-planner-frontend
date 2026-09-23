import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { listBatches } from '#/features/import/data/batches'
import type { LocalImportBatch } from '#/db/types'

export type ImportHistory = {
  batches: LocalImportBatch[]
  loading: boolean
}

/** The hub's recent-imports strip: the newest batches this device committed. */
export function useImportHistory(limit = 5): ImportHistory {
  const batches = useLiveQuery(() => listBatches(limit), [limit])
  return { batches: batches ?? [], loading: batches === undefined }
}

/**
 * One batch as it stands now. The Done screen is handed the batch the commit returned, and
 * that snapshot cannot know it was later undone — this is how it finds out.
 */
export function useImportBatch(id: string): LocalImportBatch | undefined {
  return useLiveQuery(() => db.importBatches.get(id), [id])
}
