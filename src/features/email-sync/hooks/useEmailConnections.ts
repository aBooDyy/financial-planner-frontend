import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalEmailConnection } from '#/db/types'
import { pullConnections } from '#/features/email-sync/data/cache'

/** Reactive list of the caller's connected inboxes (from the local cache), refreshed on mount. */
export function useEmailConnections(): {
  connections: LocalEmailConnection[]
  loading: boolean
} {
  const rows = useLiveQuery(() => db.emailConnections.toArray())

  useEffect(() => {
    void pullConnections()
  }, [])

  return { connections: rows ?? [], loading: rows === undefined }
}
