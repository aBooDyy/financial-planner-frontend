import { useEffect, useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { WalletTarget } from '#/features/import/data/types'
import type { CurrencyCode } from '#/lib/currency'
import { newId } from '#/lib/uuid'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The file's own spelling, which seeds the name. */
  raw: string
  baseCurrency: CurrencyCode
  onCreate: (target: WalletTarget) => void
}

/**
 * Records an account to create at import time. The id is minted here so every row bound to
 * it is final before anything is written — the account itself is created by the commit.
 */
export function CreateWalletDialog({
  open,
  onOpenChange,
  raw,
  baseCurrency,
  onCreate,
}: Props) {
  const [name, setName] = useState(raw)
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency)

  useEffect(() => {
    if (open) {
      setName(raw)
      setCurrency(baseCurrency)
    }
  }, [open, raw, baseCurrency])

  const trimmed = name.trim()

  const submit = () => {
    if (trimmed === '') return
    onCreate({
      kind: 'create',
      walletId: newId(),
      name: trimmed,
      currency,
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New account"
      description="It is created when you import — nothing is written yet."
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          submitLabel="Add account"
          disabled={trimmed === ''}
          onSubmit={submit}
        />
      }
    >
      <div>
        <FieldLabel htmlFor="new-wallet-name">Name</FieldLabel>
        <Input
          id="new-wallet-name"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div>
        <FieldLabel>Currency</FieldLabel>
        <CurrencyPicker
          value={currency}
          base={baseCurrency}
          label="Account currency"
          onChange={setCurrency}
        />
      </div>

      <NoteBox tone="neutral">
        It starts at zero. Balances are worked out from your transactions, so an
        opening amount would count the rows you are importing twice.
      </NoteBox>
    </ResponsiveDialog>
  )
}
