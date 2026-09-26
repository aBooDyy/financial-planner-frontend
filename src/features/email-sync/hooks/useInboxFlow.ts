import { useState } from 'react'
import type { LocalEmailConnection } from '#/db/types'
import { disconnectConnection } from '#/features/email-sync/data/mutations'
import { messageForApiError } from '#/lib/errorMessages'

/** What the settings page was opened for — a new inbox, or a rule to fix. */
export type InboxIntent = {
  inbox?: string
  rule?: string
  sample?: string
  fresh?: boolean
}

export type EditorIntent = {
  /** Open straight onto a new rule. */
  fresh: boolean
  fix: { ruleId: string | null; importId: string } | undefined
}

const NO_INTENT: EditorIntent = { fresh: false, fix: undefined }

/**
 * Which of the Email sync dialogs is open: connecting an inbox, one inbox's editor (and why it
 * was opened), or the disconnect confirmation.
 */
export function useInboxFlow(initial: InboxIntent) {
  const [connecting, setConnecting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(
    initial.inbox ?? null,
  )
  const [intent, setIntent] = useState<EditorIntent>(
    initial.inbox
      ? {
          fresh: Boolean(initial.fresh) && !initial.sample,
          fix: initial.sample
            ? { ruleId: initial.rule ?? null, importId: initial.sample }
            : undefined,
        }
      : NO_INTENT,
  )
  const [pending, setPending] = useState<LocalEmailConnection | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)

  const confirmDisconnect = async () => {
    if (!pending || busy) return
    setBusy(true)
    setPendingError(null)
    try {
      await disconnectConnection(pending.id)
      if (editingId === pending.id) setEditingId(null)
      setPending(null)
    } catch (error) {
      setPendingError(messageForApiError(error))
    } finally {
      setBusy(false)
    }
  }

  return {
    connecting,
    startConnect: () => setConnecting(true),
    cancelConnect: () => setConnecting(false),
    editingId,
    intent,
    edit: (connection: LocalEmailConnection) => {
      setIntent(NO_INTENT)
      setEditingId(connection.id)
    },
    /** Open the inbox's editor straight onto a new rule. */
    addRule: (connection: LocalEmailConnection) => {
      setIntent({ fresh: true, fix: undefined })
      setEditingId(connection.id)
    },
    closeEditor: () => {
      setEditingId(null)
      setIntent(NO_INTENT)
    },
    pending,
    busy,
    pendingError,
    askDisconnect: (connection: LocalEmailConnection) => {
      setPendingError(null)
      setPending(connection)
    },
    confirmDisconnect,
    cancelDisconnect: () => setPending(null),
  }
}
