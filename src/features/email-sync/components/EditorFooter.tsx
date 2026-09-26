import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type Props = {
  /** What happens next, or why the primary action is unavailable. */
  hint?: ReactNode
  /** Shown in place of the hint, announced. */
  error?: string | null
  onCancel: () => void
  submitLabel: ReactNode
  onSubmit: () => void
  disabled?: boolean
}

/** A wide dialog's footer: the hint at the start, Cancel and the primary action at the end. */
export function EditorFooter({
  hint,
  error,
  onCancel,
  submitLabel,
  onSubmit,
  disabled,
}: Props) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div
        role={error ? 'alert' : undefined}
        className={cn(
          'flex min-w-[160px] flex-1 items-center gap-[7px] text-[12.5px] leading-[1.4] font-semibold',
          error ? 'text-fp-danger' : 'text-fp-text-3',
        )}
      >
        {error ?? hint}
      </div>
      <Button type="button" variant="quiet" size="dialog" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        type="button"
        size="dialog"
        disabled={disabled}
        onClick={onSubmit}
        className="gap-1.5"
      >
        {submitLabel}
      </Button>
    </div>
  )
}
