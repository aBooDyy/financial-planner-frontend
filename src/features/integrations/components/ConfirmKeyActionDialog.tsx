import type { ReactNode } from 'react'
import { Ban, KeyRound, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { DialogTone } from '#/components/ui/responsive-dialog'

export type KeyAction = 'rotate' | 'revoke' | 'delete'

type ActionCopy = {
  title: (name: string) => string
  body: string
  confirm: string
  busy: string
  tone: DialogTone
  icon: ReactNode
}

const COPY: Record<KeyAction, ActionCopy> = {
  rotate: {
    title: (name) => `Rotate the secret for “${name}”?`,
    body: 'The old key stops working right away and the app using it will need the new one.',
    confirm: 'Rotate',
    busy: 'Rotating…',
    tone: 'warn',
    icon: <KeyRound />,
  },
  revoke: {
    title: (name) => `Revoke “${name}”?`,
    body: 'It stops accepting new transactions. Nothing already added changes.',
    confirm: 'Revoke',
    busy: 'Revoking…',
    tone: 'danger',
    icon: <Ban />,
  },
  delete: {
    title: (name) => `Delete “${name}”?`,
    body: 'Its rules go with it. Transactions it already added stay in your ledger, and anything still waiting for review stays in the review queue.',
    confirm: 'Delete',
    busy: 'Deleting…',
    tone: 'danger',
    icon: <Trash2 />,
  },
}

type Props = {
  action: KeyAction | null
  keyName: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/** Every confirm says exactly what survives, because that is what the user is weighing. */
export function ConfirmKeyActionDialog({
  action,
  keyName,
  busy,
  error,
  onConfirm,
  onClose,
}: Props) {
  const copy = COPY[action ?? 'rotate']
  return (
    <ConfirmDialog
      open={action !== null}
      contentClassName="sm:max-w-[440px]"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={copy.title(keyName)}
      tone={copy.tone}
      icon={copy.icon}
      confirmLabel={busy ? copy.busy : copy.confirm}
      confirmVariant={action === 'rotate' ? 'default' : 'destructive'}
      onConfirm={onConfirm}
      busy={busy}
      error={error}
    >
      <p>{copy.body}</p>
    </ConfirmDialog>
  )
}
