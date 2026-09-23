import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { isUsableAlias } from '#/features/merchants/data/mutations'
import type { MerchantTarget } from '#/features/import/data/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  raw: string
  onCreate: (target: MerchantTarget) => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

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
      merchantId: crypto.randomUUID(),
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
      footer={
        <>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!usable} onClick={submit}>
            Add merchant
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div>
          <Label className={LABEL} htmlFor="new-merchant-name">
            Name
          </Label>
          <Input
            id="new-merchant-name"
            value={name}
            autoFocus
            aria-invalid={trimmed !== '' && !usable}
            onChange={(event) => setName(event.target.value)}
          />
          {trimmed !== '' && !usable ? (
            <p className="mt-[6px] text-[12.5px] text-fp-danger">
              That name has no letters or digits we can recognise. Add a Latin
              spelling so this merchant can be found again.
            </p>
          ) : null}
        </div>

        <p className="rounded-xl bg-fp-surface-2 px-3 py-2.5 text-[12.5px] text-fp-text-2">
          {spellingUsable
            ? `“${raw}” is filed as another spelling for it, so the next import recognises it without asking.`
            : `“${raw}” cannot be stored as a spelling, so this import binds it but the next one will ask again.`}
        </p>
      </div>
    </ResponsiveDialog>
  )
}
