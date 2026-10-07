import { useCallback, useState } from 'react'
import type { LocalEmailConnection } from '#/db/types'
import { beginInboxReconnect } from '#/features/email-sync/data/connect'
import { messageForApiError } from '#/lib/errorMessages'

export type InboxReconnect = {
  reconnect: () => void
  /** Fetching the consent URL; the page is about to leave. */
  busy: boolean
  error: string | null
}

const here = (): string =>
  `${window.location.pathname}${window.location.search}`

/** Sign one inbox in again, coming back to the page the user pressed it on. */
export function useInboxReconnect(
  connection: Pick<LocalEmailConnection, 'id' | 'provider'>,
): InboxReconnect {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { id, provider } = connection

  const reconnect = useCallback(() => {
    setBusy(true)
    setError(null)
    beginInboxReconnect({ id, provider }, here()).catch((err: unknown) => {
      setBusy(false)
      setError(messageForApiError(err))
    })
  }, [id, provider])

  return { reconnect, busy, error }
}
