import { Mail } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'

type Props = {
  email: string | null
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

export function DisconnectInboxDialog({
  email,
  busy,
  error,
  onConfirm,
  onClose,
}: Props) {
  return (
    <ConfirmDialog
      open={email !== null}
      onOpenChange={(next) => !next && onClose()}
      tone="danger"
      icon={<Mail />}
      title="Disconnect this inbox?"
      cancelLabel="Keep it"
      confirmLabel={busy ? 'Disconnecting…' : 'Disconnect'}
      onConfirm={onConfirm}
      busy={busy}
      error={error}
    >
      <p>
        Means stops reading{' '}
        <bdi className="font-bold text-fp-text">{email}</bdi> and forgets its
        rules. Alerts still waiting for review from it are removed; transactions
        you already confirmed stay in your ledger.
      </p>
    </ConfirmDialog>
  )
}
