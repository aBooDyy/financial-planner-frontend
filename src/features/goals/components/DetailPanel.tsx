import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useIsDesktop, useMediaQuery } from '#/hooks/useMediaQuery'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'

type Props = {
  title: ReactNode
  subtitle: string
  footer: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * Where a selected item is edited: a docked right rail on wide screens, a rail laid over the
 * list on narrower desktops (so the list keeps its width), and a bottom sheet on mobile.
 */
export function DetailPanel({
  title,
  subtitle,
  footer,
  onClose,
  children,
}: Props) {
  const isDesktop = useIsDesktop()
  const isWide = useMediaQuery('(min-width: 1120px)')

  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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
      className={`flex w-[330px] flex-none flex-col border-s border-fp-border bg-fp-surface ${
        isWide
          ? ''
          : 'absolute inset-y-0 end-0 z-30 max-w-[86%] shadow-[-18px_0_40px_-24px_rgba(20,18,12,0.4)]'
      }`}
    >
      <div className="flex-1 overflow-auto px-[18px] pt-[18px] pb-[30px]">
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold tracking-[-0.01em]">
              {title}
            </div>
            <div className="mt-[2px] text-[11.5px] text-fp-text-3">
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-fp-surface-2 text-fp-text-2 hover:text-fp-text"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        <div className="mt-[18px] flex items-center gap-2">{footer}</div>
      </div>
    </aside>
  )
}
