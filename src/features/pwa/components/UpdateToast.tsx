import { RefreshCw, X } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  open: boolean
  onReload: () => void
  onDismiss: () => void
}

/**
 * The "new version available" card, floating bottom-centre: clear of the mobile tab bar and
 * its raised add button, and under any open dialog's overlay so it can't reload a
 * half-filled form. The live region stays mounted so screen readers announce it appearing.
 */
export function UpdateToast({ open, onReload, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 flex justify-center px-4 md:bottom-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      {open ? (
        <div className="pointer-events-auto flex w-full max-w-[420px] animate-in items-center gap-3 rounded-[16px] border border-fp-border bg-fp-surface py-3 ps-3 pe-2 shadow-fp fade-in-0 slide-in-from-bottom-2">
          <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-fp-accent-soft text-fp-accent">
            <RefreshCw size={17} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-fp-text">
              New version available
            </p>
            <p className="text-[12.5px] text-fp-text-2">
              Reload to update. Your data stays on this device.
            </p>
          </div>
          <Button size="sm" onClick={onReload}>
            Reload
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Not now"
            onClick={onDismiss}
            className="text-fp-text-3"
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
