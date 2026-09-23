import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'

export type KeyAction = 'rotate' | 'revoke' | 'delete'

const COPY: Record<
  KeyAction,
  { title: (name: string) => string; body: string; confirm: string }
> = {
  rotate: {
    title: (name) => `Rotate the secret for “${name}”?`,
    body: 'The old key stops working right away and the app using it will need the new one.',
    confirm: 'Rotate',
  },
  revoke: {
    title: (name) => `Revoke “${name}”?`,
    body: 'It stops accepting new transactions. Nothing already added changes.',
    confirm: 'Revoke',
  },
  delete: {
    title: (name) => `Delete “${name}”?`,
    body: 'Its rules go with it. Transactions it already added stay in your ledger, and anything still waiting for review stays in the review queue.',
    confirm: 'Delete',
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
  const copy = action ? COPY[action] : null
  return (
    <ResponsiveDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={copy ? copy.title(keyName) : ''}
      contentClassName="sm:max-w-[440px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={action === 'rotate' ? 'default' : 'destructive'}
            disabled={busy}
            onClick={onConfirm}
          >
            {copy?.confirm}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-fp-text-2">{copy?.body}</p>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-fp-danger">
          {error}
        </p>
      ) : null}
    </ResponsiveDialog>
  )
}
