import { useEffect } from 'react'
import { pullInboundImportsDelta } from '#/features/inbound-imports/data/sync'

/**
 * Pull the queue's changes once when the review opens. Webhook rows arrive on their own,
 * so the moment the user looks is the moment the cache is worth freshening. A failure
 * leaves the cached rows on screen.
 */
export function useRefreshQueue(): void {
  useEffect(() => {
    void pullInboundImportsDelta().catch(() => undefined)
  }, [])
}
