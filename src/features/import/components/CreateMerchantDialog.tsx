import { useEffect, useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { isUsableAlias } from '#/features/merchants/data/mutations'
import type { MerchantTarget } from '#/features/import/data/types'
import { newId } from '#/lib/uuid'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  raw: string
  onCreate: (target: MerchantTarget) => void
}

/**
 * Records a merchant to create at import time. The name has to survive normalisation, or it
 * can never be an identifier — an Arabic-only spelling normalises to nothing, so the dialog
 * asks for a Latin one rather than filing a merchant nothing will ever match again.
 */
export function CreateMerchantDialog({
  open,
  onOpenChange,
  raw,
  onCreate,
}: Props) {
  const [name, setName] = useState(raw)

  useEffect(() => {
    if (open) setName(raw)
  }, [open, raw])

  const trimmed = name.trim()
  const usable = isUsableAlias(trimmed)
  const spellingUsable = isUsableAlias(raw)

  const submit = () => {
    if (!usable) return
    onCreate({
      kind: 'create',
      merchantId: newId(),
      displayName: trimmed,
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New merchant"
      description="It is created when you import — nothing is written yet."
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          submitLabel="Add merchant"
          disabled={!usable}
          onSubmit={submit}
        />
      }
    >
      <FormRow
        id="new-merchant-name"
        label="Name"
        error={
          trimmed !== '' && !usable
            ? 'That name has no letters or digits we can recognise. Add a Latin spelling so this merchant can be found again.'
            : null
        }
      >
        <Input
          id="new-merchant-name"
          value={name}
          autoFocus
          aria-invalid={trimmed !== '' && !usable}
          onChange={(event) => setName(event.target.value)}
        />
      </FormRow>

      <NoteBox tone={spellingUsable ? 'accent' : 'warn'}>
        {spellingUsable
          ? `“${raw}” is filed as another spelling for it, so the next import recognises it without asking.`
          : `“${raw}” cannot be stored as a spelling, so this import binds it but the next one will ask again.`}
      </NoteBox>
    </ResponsiveDialog>
  )
}
