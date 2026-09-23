import { useEmailConnections } from '#/features/email-sync/hooks/useEmailConnections'
import { usePendingImports } from '#/features/inbound-imports/hooks/usePendingImports'
import { useDirectionStore } from '#/stores/direction'
import { formatRelativeTime } from '#/lib/date'

export type InboxConnectionSummary = {
  id: string
  email: string
  lastScanned: string
}

export type InboxSummary = {
  loading: boolean
  connections: InboxConnectionSummary[]
  pendingCount: number
}

// How recent the last scan was is the question here, not which calendar day it fell on.
const lastScannedLabel = (iso: string | null, locale: string): string => {
  const when = iso === null ? null : formatRelativeTime(iso, locale)
  return when === null ? 'Not scanned yet' : `Last scanned ${when}`
}

/** What the hub's inbox card shows: the connected inboxes and how much awaits review. */
export function useInboxSummary(): InboxSummary {
  const { connections, loading } = useEmailConnections()
  const { count } = usePendingImports()
  const locale = useDirectionStore((s) => s.locale)

  return {
    loading,
    pendingCount: count,
    connections: connections
      .filter((c) => c.status === 'connected')
      .map((c) => ({
        id: c.id,
        email: c.email,
        lastScanned: lastScannedLabel(c.lastSyncedAt, locale),
      })),
  }
}
