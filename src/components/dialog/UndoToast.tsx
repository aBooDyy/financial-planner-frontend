import { cn } from '#/lib/utils'

type Props = {
  message: string
  /** Offers Undo while what just happened can still be taken back. */
  onUndo?: () => void
  /** Lifts it clear of a footer taller than the usual one row. */
  className?: string
}

/**
 * A dark line floating over the bottom of a dialog: what just happened, and Undo while it can
 * still be taken back. Positioned against the dialog, so render it inside one.
 */
export function UndoToast({ message, onUndo, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto absolute inset-x-4 bottom-[84px] z-10 mx-auto flex w-max max-w-[calc(100%-32px)] items-center gap-[14px] rounded-[12px] bg-fp-text py-[10px] ps-4 pe-3 text-[13px] font-semibold text-fp-surface shadow-[0_12px_24px_-10px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      <span className="min-w-0 truncate">{message}</span>
      {onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 font-extrabold text-[color-mix(in_srgb,var(--fp-accent)_55%,var(--fp-surface))] hover:underline"
        >
          Undo
        </button>
      ) : null}
    </div>
  )
}
