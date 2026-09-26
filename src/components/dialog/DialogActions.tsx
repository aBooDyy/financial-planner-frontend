import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type Props = {
  /** What still blocks saving, above the buttons; null when the entry is ready. */
  hint?: string | null
  onDelete?: () => void
  deleteLabel?: string
  /** Between Delete and Cancel (e.g. Archive). */
  extra?: ReactNode
  onCancel?: () => void
  cancelLabel?: string
  submitLabel: ReactNode
  onSubmit?: () => void
  /** `submit` hands the press to the surrounding form. */
  submitType?: 'button' | 'submit'
  /** For a submit button outside its form. */
  form?: string
  /** Looks unavailable while the entry isn't ready, but can still be pressed to see why. */
  ready?: boolean
  /** Can't be pressed at all. */
  disabled?: boolean
}

/** A dialog's pinned footer: [Delete] [extra] [Cancel] and the full-width primary action. */
export function DialogActions({
  hint,
  onDelete,
  deleteLabel = 'Delete',
  extra,
  onCancel,
  cancelLabel = 'Cancel',
  submitLabel,
  onSubmit,
  submitType = 'button',
  form,
  ready = true,
  disabled,
}: Props) {
  return (
    <div className="flex w-full flex-col gap-2">
      {hint ? (
        <p className="text-center text-[12px] font-semibold text-fp-text-3">
          {hint}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        {onDelete ? (
          <Button
            type="button"
            variant="danger-soft"
            size="dialog"
            onClick={onDelete}
            className="px-[14px]"
          >
            {deleteLabel}
          </Button>
        ) : null}
        {extra}
        {onCancel ? (
          <Button
            type="button"
            variant="quiet"
            size="dialog"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type={submitType}
          form={form}
          size="dialog"
          onClick={onSubmit}
          disabled={disabled}
          aria-disabled={!ready || undefined}
          className={cn(
            'min-w-0 flex-1 px-[18px]',
            !ready &&
              'bg-fp-surface-2 text-fp-text-3 shadow-none! hover:bg-fp-surface-2 hover:brightness-100 disabled:opacity-100',
          )}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
