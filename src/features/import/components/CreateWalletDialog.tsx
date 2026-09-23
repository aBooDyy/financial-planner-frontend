import { useEffect, useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { WalletTarget } from '#/features/import/data/types'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The file's own spelling, which seeds the name. */
  raw: string
  baseCurrency: CurrencyCode
  onCreate: (target: WalletTarget) => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

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
      walletId: crypto.randomUUID(),
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
          <Button type="button" disabled={trimmed === ''} onClick={submit}>
            Add account
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div>
          <Label className={LABEL} htmlFor="new-wallet-name">
            Name
          </Label>
          <Input
            id="new-wallet-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <Label className={LABEL}>Currency</Label>
          <CurrencyPicker
            value={currency}
            base={baseCurrency}
            label="Account currency"
            onChange={setCurrency}
          />
        </div>

        <p className="rounded-xl bg-fp-surface-2 px-3 py-2.5 text-[12.5px] text-fp-text-2">
          It starts at zero. Balances are worked out from your transactions, so
          an opening amount would count the rows you are importing twice.
        </p>
      </div>
    </ResponsiveDialog>
  )
}
