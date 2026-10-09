import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { Passkey } from '#/features/passkeys/api/types'
import { messageForApiError } from '#/lib/errorMessages'

type Props = {
  passkey: Passkey
  onRemove: () => Promise<void>
  onClose: () => void
}

export function RemovePasskeyDialog({ passkey, onRemove, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRemove()
      onClose()
    } catch (err) {
      setError(messageForApiError(err))
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      tone="danger"
      icon={<KeyRound />}
      title="Remove this passkey?"
      cancelLabel="Keep it"
      confirmLabel={busy ? 'Removing…' : 'Remove'}
      onConfirm={() => void confirm()}
      busy={busy}
      error={error}
      note="Your device may still offer it — delete it from your password manager too."
    >
      <p>
        <bdi className="font-bold text-fp-text">{passkey.name}</bdi> will no
        longer sign you in to Means. Your password and other passkeys keep
        working.
      </p>
    </ConfirmDialog>
  )
}
