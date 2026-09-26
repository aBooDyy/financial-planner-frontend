import { useCallback, useState } from 'react'
import { retrySync } from '#/db/syncRetry'
import type { OutboxEntity } from '#/db/types'

/** "Retry now" for one row: pushes its queued changes at once, ignoring their backoff. */
export function useSyncRetry(
  entity: OutboxEntity,
  id: string | null,
): { retry: () => void; retrying: boolean } {
  const [retrying, setRetrying] = useState(false)
  const retry = useCallback(() => {
    if (!id) return
    setRetrying(true)
    void retrySync(entity, id).finally(() => setRetrying(false))
  }, [entity, id])
  return { retry, retrying }
}
