import { useEmailConnections } from '#/features/email-sync/hooks/useEmailConnections'
import { usePendingImports } from '#/features/inbound-imports/hooks/usePendingImports'
import { lastSyncedLabel } from '#/features/email-sync/data/describe'
import { useDirectionStore } from '#/stores/direction'

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
        lastScanned: lastSyncedLabel(c.lastSyncedAt, locale),
      })),
  }
}
