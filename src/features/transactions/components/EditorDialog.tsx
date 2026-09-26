import { useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { DialogActions } from '#/components/dialog/DialogActions'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { DeleteCopy } from '#/features/transactions/data/scheduleEditor'

type Props = {
  title: string
  onClose: () => void
  contentClassName?: string
  /** A picker shown in place of the form, with the way back to it. */
  pane?: { title: string; onBack: () => void } | null
  /** What still blocks saving; null when ready. */
  hint: string | null
  submitLabel: string
  onSubmit: () => void
  /** A saved entry's delete, asked about first. */
  remove?: (DeleteCopy & { onConfirm: () => void }) | null
  children: ReactNode
}

/** The budget, recurring and adjustment editors' frame: the dialog, its actions, and the delete prompt. */
export function EditorDialog({
  title,
  onClose,
  contentClassName,
  pane,
  hint,
  submitLabel,
  onSubmit,
  remove,
  children,
}: Props) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (open) return
          if (pane) pane.onBack()
          else onClose()
        }}
        title={pane ? pane.title : title}
        onBack={pane?.onBack}
        contentClassName={contentClassName}
        footer={
          pane ? undefined : (
            <DialogActions
              hint={hint}
              onDelete={remove ? () => setConfirming(true) : undefined}
              onCancel={onClose}
              submitLabel={submitLabel}
              ready={hint === null}
              onSubmit={onSubmit}
            />
          )
        }
      >
        {children}
      </ResponsiveDialog>
      {remove ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={remove.title}
          bullets={remove.bullets}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirming(false)
            remove.onConfirm()
          }}
        />
      ) : null}
    </>
  )
}
