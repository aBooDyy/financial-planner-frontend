import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { LocalImportTemplate } from '#/db/types'

type Props = {
  template: LocalImportTemplate | null
  onClose: () => void
  onConfirm: (template: LocalImportTemplate) => void
}

const CONSEQUENCES = [
  'Transactions it brought in stay exactly as they are.',
  'The next file like this has to be mapped again.',
]

/** Forgetting a saved mapping, said plainly: the imported rows are never touched. */
export function DeleteTemplateDialog({ template, onClose, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={template ? `Delete “${template.name}”?` : ''}
      bullets={CONSEQUENCES}
      confirmLabel="Delete"
      onConfirm={() => {
        if (template) onConfirm(template)
      }}
    />
  )
}
