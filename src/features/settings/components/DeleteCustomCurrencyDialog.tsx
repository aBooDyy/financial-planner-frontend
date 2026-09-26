import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { CurrencyRateRow } from '#/features/settings/hooks/useCurrencyRates'

type Props = {
  row: CurrencyRateRow | null
  onClose: () => void
  onConfirm: () => void
}

function consequences({ code, held }: CurrencyRateRow): string[] {
  return [
    'It leaves the currency picker and your rates.',
    held
      ? `You still hold money in ${code}, so it stays until nothing uses it.`
      : 'This can’t be undone.',
  ]
}

export function DeleteCustomCurrencyDialog({ row, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={row ? `Delete ${row.code} · ${row.meta.name}?` : ''}
      bullets={row ? consequences(row) : undefined}
      confirmLabel="Delete currency"
      onConfirm={onConfirm}
    />
  )
}
