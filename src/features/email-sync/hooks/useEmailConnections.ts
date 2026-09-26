import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalEmailConnection } from '#/db/types'
import { pullConnections } from '#/features/email-sync/data/cache'
import { useOnline } from '#/hooks/useOnline'

type EmailConnectionsModel = {
  connections: LocalEmailConnection[]
  loading: boolean
  online: boolean
  /** The last refresh failed; `connections` is what this device cached before. */
  stale: boolean
}

/**
 * The caller's connected inboxes, oldest first: rendered from the Dexie cache, refreshed from
 * the server on mount and whenever the device comes back online.
 */
export function useEmailConnections(): EmailConnectionsModel {
  const rows = useLiveQuery(() => db.emailConnections.toArray())
  const online = useOnline()
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!online) return
    let cancelled = false
    pullConnections().then(
      () => !cancelled && setStale(false),
      () => !cancelled && setStale(true),
    )
    return () => {
      cancelled = true
    }
  }, [online])

  const connections = useMemo(
    () =>
      [...(rows ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [rows],
  )

  return {
    connections,
    loading: rows === undefined,
    online,
    stale: stale || !online,
  }
}
