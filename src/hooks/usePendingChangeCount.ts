import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'

/** How many local writes are queued for the server. */
export function usePendingChangeCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0)
}
