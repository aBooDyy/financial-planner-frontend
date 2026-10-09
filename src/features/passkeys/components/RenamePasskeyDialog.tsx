import { useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { Passkey } from '#/features/passkeys/api/types'
import { messageForApiError } from '#/lib/errorMessages'

const NAME_MAX = 100
const FORM_ID = 'rename-passkey-form'

type Props = {
  passkey: Passkey
  online: boolean
  onRename: (name: string) => Promise<void>
  onClose: () => void
}

export function RenamePasskeyDialog({
  passkey,
  online,
  onRename,
  onClose,
}: Props) {
  const [name, setName] = useState(passkey.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const ready = online && trimmed !== '' && trimmed !== passkey.name

  const save = async () => {
    if (!ready || saving) return
    setSaving(true)
    setError(null)
    try {
      await onRename(trimmed)
      onClose()
    } catch (err) {
      setError(messageForApiError(err))
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      dismissible={!saving}
      title="Rename passkey"
      description="A name that tells you which device this is."
      footer={
        <DialogActions
          onCancel={onClose}
          submitLabel={saving ? 'Saving…' : 'Save'}
          submitType="submit"
          form={FORM_ID}
          disabled={!ready || saving}
        />
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <FormRow id="passkey-name" label="Name" error={error}>
          <Input
            id="passkey-name"
            autoFocus
            value={name}
            maxLength={NAME_MAX}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>
      </form>
    </ResponsiveDialog>
  )
}
