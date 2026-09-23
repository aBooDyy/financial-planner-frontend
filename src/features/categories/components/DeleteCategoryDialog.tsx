import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'

export type DeleteTarget = {
  id: string
  name: string
  isSub: boolean
  subCount: number
  txCount: number
}

type Props = {
  target: DeleteTarget | null
  onClose: () => void
  onConfirm: () => void
}

const title = (t: DeleteTarget) =>
  t.subCount > 0
    ? `Delete “${t.name}” and its ${t.subCount} ${t.subCount === 1 ? 'subcategory' : 'subcategories'}?`
    : `Delete “${t.name}”?`

const body = (t: DeleteTarget) =>
  t.isSub
    ? `${t.txCount} transactions keep the label but lose the link to this subcategory.`
    : `${t.txCount} transactions keep their labels. This can’t be undone.`

/** Deleting never touches the ledger — the confirm says so, with both counts. */
export function DeleteCategoryDialog({ target, onClose, onConfirm }: Props) {
  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? title(target) : ''}
      contentClassName="sm:max-w-[420px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" autoFocus onClick={onConfirm}>
            Delete
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
