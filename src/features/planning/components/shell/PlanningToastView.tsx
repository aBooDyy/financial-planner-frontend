import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlanningToast } from '#/features/planning/stores/toast'

const SHOWN_MS = 3600

/** Bottom-centre confirmation of the last Planning write, with an optional action. */
export function PlanningToastView() {
  const toast = usePlanningToast((s) => s.toast)
  const dismiss = usePlanningToast((s) => s.dismiss)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => dismiss(toast.id), SHOWN_MS)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[60] flex justify-center px-4 md:bottom-7"
    >
      {toast ? (
        <div
          key={toast.id}
          className="pointer-events-auto flex max-w-[460px] animate-in items-center gap-[14px] rounded-[14px] bg-fp-text py-[11px] ps-4 pe-3 text-[13px] font-semibold text-fp-surface shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)] fade-in-0 slide-in-from-bottom-2"
        >
          <span className="min-w-0">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.run()
                dismiss(toast.id)
              }}
              className="shrink-0 font-extrabold text-[color-mix(in_srgb,var(--fp-accent)_60%,var(--fp-surface))] hover:underline"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
