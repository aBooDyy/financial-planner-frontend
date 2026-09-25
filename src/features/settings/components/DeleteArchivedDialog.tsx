import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { ArchivedItem } from '#/features/balances/data/archivedList'

type Props = {
  target: ArchivedItem | null
  onClose: () => void
  onConfirm: () => void
}

const body = (t: ArchivedItem) => {
  const inside =
    t.walletCount > 0
      ? ` and the ${t.walletCount} ${t.walletCount === 1 ? 'wallet' : 'wallets'} inside it`
      : ''
  return `This removes “${t.name}”${inside}, along with every transaction recorded against ${t.kind === 'group' ? 'them' : 'it'}. This can’t be undone.`
}

/** Unlike archiving, deleting takes the ledger with it — so this one does warn. */
export function DeleteArchivedDialog({ target, onClose, onConfirm }: Props) {
  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? `Delete “${target.name}” for good?` : ''}
      contentClassName="sm:max-w-[420px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" autoFocus onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete forever
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-fp-text-2">
        {target ? body(target) : null}
      </p>
    </ResponsiveDialog>
  )
}
