import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { walletsInsideLine } from '#/features/wallets/data/archivedList'
import type { ArchiveTarget } from '#/features/wallets/data/archivedList'

export type DeleteNodeTarget = Pick<
  ArchiveTarget,
  'name' | 'kind' | 'walletCount'
>

type Props = {
  target: DeleteNodeTarget | null
  /** Already archived: deleting is what's left, so there is no archive to suggest instead. */
  archived?: boolean
  /** "SR 1,900.00" set aside in it, freed by the delete; null when it holds none. */
  heldStr?: string | null
  onClose: () => void
  onConfirm: () => void
}

function consequences(t: DeleteNodeTarget, heldStr: string | null): string[] {
  const inside = walletsInsideLine(t.walletCount)
  return [
    ...(inside ? [inside] : []),
    `Every transaction recorded against ${inside ? 'them' : 'it'} is deleted too.`,
    ...(heldStr
      ? [
          `The ${heldStr} set aside in ${inside ? 'them' : 'it'} is freed; its bills and goals plan for it again.`,
        ]
      : []),
    'This can’t be undone.',
  ]
}

/** Unlike archiving, deleting takes the ledger with it — so this one does warn. */
export function DeleteNodeDialog({
  target,
  archived,
  heldStr = null,
  onClose,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      tone="danger"
      title={
        target ? `Delete “${target.name}”${archived ? ' for good' : ''}?` : ''
      }
      bullets={target ? consequences(target, heldStr) : undefined}
      note={archived ? undefined : 'To keep its history, archive it instead.'}
      confirmLabel={
        archived ? 'Delete forever' : `Delete ${target?.kind ?? ''}`
      }
      onConfirm={onConfirm}
    />
  )
}
