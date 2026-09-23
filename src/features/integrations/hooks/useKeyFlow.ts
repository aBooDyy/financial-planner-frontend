import { useState } from 'react'
import type { LocalIntegrationKey } from '#/db/types'
import type { CreatedKey } from '#/features/integrations/api/types'
import type { KeyAction } from '#/features/integrations/components/ConfirmKeyActionDialog'
import { failureMessage } from '#/features/integrations/data/errors'
import type { KeyActions } from './useIntegrationKeys'

type Reveal = { token: string; keyId: string; kind: 'created' | 'rotated' }
type Pending = { action: KeyAction; key: LocalIntegrationKey }

/**
 * Which of the Integrations dialogs is open, and the hand-offs between them: create → reveal
 * the secret → the new key's editor; rotate → reveal. The secret lives only in this state and
 * is dropped the moment the reveal is dismissed.
 */
export function useKeyFlow(actions: KeyActions, initialEditingId?: string) {
  const [creating, setCreating] = useState<{
    session: number
    name: string
  } | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [editingId, setEditingId] = useState<string | null>(
    initialEditingId ?? null,
  )
  const [freshId, setFreshId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)

  const startCreate = (name = '') =>
    setCreating((c) => ({ session: (c?.session ?? 0) + 1, name }))

  const onCreated = ({ key, token }: CreatedKey) => {
    setCreating(null)
    setReveal({ token, keyId: key.id, kind: 'created' })
  }

  const finishReveal = () => {
    if (reveal?.kind === 'created') {
      setEditingId(reveal.keyId)
      setFreshId(reveal.keyId)
    }
    setReveal(null)
  }

  const ask = (action: KeyAction, key: LocalIntegrationKey) => {
    setPendingError(null)
    setPending({ action, key })
  }

  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true)
    const { action, key } = pending
    const settle = (failure: string | null) => {
      setBusy(false)
      setPendingError(failure)
      if (failure === null) setPending(null)
    }
    if (action === 'rotate') {
      const outcome = await actions.rotate(key)
      settle(outcome.ok ? null : failureMessage(outcome.failure))
      if (outcome.ok) {
        setReveal({
          token: outcome.value.token,
          keyId: key.id,
          kind: 'rotated',
        })
      }
      return
    }
    const outcome =
      action === 'revoke'
        ? await actions.revoke(key)
        : await actions.remove(key.id)
    settle(outcome.ok ? null : failureMessage(outcome.failure))
  }

  return {
    creating,
    startCreate,
    cancelCreate: () => setCreating(null),
    onCreated,
    reveal,
    finishReveal,
    editingId,
    /** The key being edited was just created — its editor opens on a first rule. */
    editingFresh: editingId !== null && editingId === freshId,
    edit: (key: LocalIntegrationKey) => setEditingId(key.id),
    closeEditor: () => {
      setEditingId(null)
      setFreshId(null)
    },
    pending,
    busy,
    pendingError,
    ask,
    confirm,
    cancelPending: () => setPending(null),
  }
}
