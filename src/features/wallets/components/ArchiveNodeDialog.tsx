import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { walletsInsideLine } from '#/features/wallets/data/archivedList'
import type { ArchiveTarget } from '#/features/wallets/data/archivedList'

type Props = {
  target: ArchiveTarget | null
  onClose: () => void
  onConfirm: () => void
}

function consequences(t: ArchiveTarget): string[] {
  const inside = walletsInsideLine(t.walletCount)
  return [
    'It leaves the Wallets page, your totals and every account picker.',
    'Its transactions stay in your history, untouched.',
    ...(inside ? [inside] : []),
    ...(t.holdingStr
      ? [`${t.holdingStr} stops counting toward your total.`]
      : []),
  ]
}

/** Archiving is reversible, so the confirm spells out what changes rather than warning. */
export function ArchiveNodeDialog({ target, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      tone="neutral"
      title={target ? `Archive “${target.name}”?` : ''}
      bullets={target ? consequences(target) : undefined}
      note="Restore it anytime from Settings › Archived."
      confirmLabel={`Archive ${target?.kind ?? ''}`}
      onConfirm={onConfirm}
    />
  )
}
