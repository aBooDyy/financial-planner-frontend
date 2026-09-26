import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'

type Props = {
  title: ReactNode
  subtitle: string
  footer: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * Where a selected item is read or edited: a rail laid over the page's end edge on desktop (so
 * the content underneath never reflows), and a bottom sheet on mobile.
 */
export function DetailPanel({
  title,
  subtitle,
  footer,
  onClose,
  children,
}: Props) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      // A Radix layer (a dialog or menu opened from the panel) that dismissed itself on this
      // Escape marks it handled; the panel stays.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('[role="dialog"]'))
        return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, onClose])

  if (!isDesktop) {
    return (
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        title={title}
        description={subtitle}
        footer={footer}
      >
        {children}
      </ResponsiveDialog>
    )
  }

  return (
    <aside
      data-side-pane
      className="flex h-full w-[330px] max-w-full flex-col rounded-[18px] border border-fp-border bg-fp-surface text-fp-text shadow-[-20px_0_50px_-20px_rgba(20,18,12,0.35)] rtl:shadow-[20px_0_50px_-20px_rgba(20,18,12,0.35)]"
    >
      <div className="flex flex-none items-start gap-[10px] px-5 pt-[18px]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] leading-[1.3] font-extrabold tracking-[-0.01em]">
            {title}
          </div>
          <div className="mt-[3px] text-[13px] leading-[1.45] text-fp-text-2">
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-fp-surface-2 text-fp-text-2 transition hover:text-fp-text"
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-auto px-5 pt-4 pb-[18px]">
        {children}
      </div>
      <div className="flex flex-none items-center gap-2 px-5 pb-5">
        {footer}
      </div>
    </aside>
  )
}

/**
 * Positions the panel over the end edge and slides it in once on open. It stays mounted while
 * the panel swaps content (read view ↔ editor, one goal to another), so those swaps don't
 * replay the slide. Sizeless on its own, so it never covers anything when the panel renders as a
 * mobile sheet instead.
 */
export function DetailPanelOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-y-3 end-3 z-30 flex max-w-[86%] duration-200 ease-out animate-in slide-in-from-end">
      {children}
    </div>
  )
}
