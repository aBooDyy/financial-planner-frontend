import { useState } from 'react'
import type { EmailProvider } from '#/features/email-sync/api/types'
import { beginInboxConnect } from '#/features/email-sync/data/connect'
import { disconnectConnection } from '#/features/email-sync/data/mutations'
import { useEmailConnections } from '#/features/email-sync/hooks/useEmailConnections'
import { messageForApiError } from '#/lib/errorMessages'

const RETURN_TO = '/setup'

/** The optional inbox connect: leaves for the provider and comes back to setup. */
export function useInboxConnect() {
  const { connections } = useEmailConnections()
  const [connecting, setConnecting] = useState<EmailProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connect = async (provider: EmailProvider) => {
    setConnecting(provider)
    setError(null)
    try {
      await beginInboxConnect(provider, RETURN_TO)
    } catch (e) {
      setError(messageForApiError(e))
      setConnecting(null)
    }
  }

  const undo = async (id: string) => {
    setError(null)
    try {
      await disconnectConnection(id)
    } catch (e) {
      setError(messageForApiError(e))
    }
  }

  return { inbox: connections.at(0) ?? null, connecting, error, connect, undo }
}
