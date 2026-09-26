import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { MerchantView } from '#/features/merchants/hooks/useMerchants'

type Props = {
  merchant: MerchantView | null
  onClose: () => void
  onConfirm: () => void
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function consequences({ aliases, txCount }: MerchantView): string[] {
  return [
    `Its ${plural(aliases.length, 'spelling')} ${aliases.length === 1 ? 'is' : 'are'} forgotten, so new entries won’t be recognised as it.`,
    ...(txCount > 0
      ? [
          `Its ${plural(txCount, 'transaction')} ${txCount === 1 ? 'stays' : 'stay'}, just without a merchant.`,
        ]
      : []),
  ]
}

export function DeleteMerchantDialog({ merchant, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={merchant !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={merchant ? `Delete “${merchant.displayName}”?` : ''}
      bullets={merchant ? consequences(merchant) : undefined}
      note="To keep its history under another name, merge it instead."
      confirmLabel="Delete merchant"
      onConfirm={onConfirm}
    />
  )
}
