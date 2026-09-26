import { useCallback, useEffect, useMemo, useState } from 'react'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type { InboxMessage } from '#/features/email-sync/api/types'
import {
  groupMessages,
  mergeMessages,
} from '#/features/email-sync/data/samples'
import type { SampleGroup } from '#/features/email-sync/data/samples'
import { messageForApiError } from '#/lib/errorMessages'

export type InboxSamples = {
  status: 'idle' | 'loading' | 'ready' | 'failed'
  error: string | null
  messages: InboxMessage[]
  groups: SampleGroup[]
  /** The sender whose older mail is being fetched, if any. */
  loadingSender: string | null
  loadMoreFrom: (sender: string) => Promise<void>
  reload: () => void
}

/**
 * The inbox's recent mail, folded into template groups, for picking a sample and testing
 * rules against. Fetched when the editor needs it and never cached — it is the inbox itself.
 */
export function useInboxSamples(
  connectionId: string,
  enabled: boolean,
): InboxSamples {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [status, setStatus] = useState<InboxSamples['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loadingSender, setLoadingSender] = useState<string | null>(null)
  const [loads, setLoads] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    setStatus('loading')
    setError(null)
    emailSyncApi.listMessages(connectionId).then(
      (listed) => {
        if (!active) return
        setMessages(listed)
        setStatus('ready')
      },
      (failure: unknown) => {
        if (!active) return
        setError(messageForApiError(failure))
        setStatus('failed')
      },
    )
    return () => {
      active = false
    }
  }, [connectionId, enabled, loads])

  const loadMoreFrom = useCallback(
    async (sender: string) => {
      setLoadingSender(sender)
      try {
        const listed = await emailSyncApi.listMessages(connectionId, { sender })
        setMessages((loaded) => mergeMessages(loaded, listed))
      } catch (failure) {
        setError(messageForApiError(failure))
      } finally {
        setLoadingSender(null)
      }
    },
    [connectionId],
  )

  const groups = useMemo(() => groupMessages(messages), [messages])

  return {
    status,
    error,
    messages,
    groups,
    loadingSender,
    loadMoreFrom,
    reload: () => setLoads((n) => n + 1),
  }
}
