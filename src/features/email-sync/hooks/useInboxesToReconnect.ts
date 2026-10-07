import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalEmailConnection } from '#/db/types'

const NONE: LocalEmailConnection[] = []

/** Inboxes the provider stopped honouring, from the cache every scan refreshes. */
export function useInboxesToReconnect(): LocalEmailConnection[] {
  return (
    useLiveQuery(() =>
      db.emailConnections.where('status').equals('needs_reauth').toArray(),
    ) ?? NONE
  )
}
