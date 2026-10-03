import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import { ItemMenu } from '#/features/planning/components/kit/ItemMenu'
import type { MenuAction } from '#/features/planning/components/kit/ItemMenu'
import { Dot } from '#/features/planning/components/kit/Spine'

type Props = {
  color: string
  title: string
  sub: string
  menu: ReadonlyArray<MenuAction>
  onClose: () => void
  children: ReactNode
}

/**
 * Where a bill or goal is read: a 400px rounded panel floating 12px in from the page's end edge
 * on desktop (the page underneath never reflows), a bottom sheet on mobile.
 */
export function DetailFrame({
  color,
  title,
  sub,
  menu,
  onClose,
  children,
}: Props) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      // A dialog or menu opened from the panel closes itself first.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('[role="dialog"]'))
        return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, onClose])

  if (!isDesktop)
    return (
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        title={
          <span className="flex min-w-0 items-center gap-[10px]">
            <Dot color={color} size={12} />
            <span className="truncate">{title}</span>
          </span>
        }
        description={sub}
      >
        <div className="-mt-2 flex justify-end">
          <ItemMenu label={`More for ${title}`} actions={menu} />
        </div>
        {children}
      </ResponsiveDialog>
    )

  return (
    <aside
      aria-label={title}
      data-side-pane
      className="absolute inset-y-3 end-3 z-30 flex w-[400px] max-w-[calc(100%-24px)] animate-in flex-col rounded-[18px] border border-fp-border bg-fp-surface text-fp-text shadow-[-20px_0_50px_-20px_rgba(20,18,12,0.35)] duration-200 ease-out slide-in-from-end rtl:shadow-[20px_0_50px_-20px_rgba(20,18,12,0.35)]"
    >
      <div className="flex flex-none items-start gap-[10px] px-5 pt-[18px]">
        <span className="mt-[7px]">
          <Dot color={color} size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] leading-[1.3] font-extrabold tracking-[-0.01em]">
            {title}
          </h2>
          <p className="mt-[3px] text-[13px] leading-[1.45] text-fp-text-2">
            {sub}
          </p>
        </div>
        <ItemMenu label={`More for ${title}`} actions={menu} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-fp-surface-2 text-fp-text-2 transition hover:text-fp-text"
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 pt-4 pb-5">
        {children}
      </div>
    </aside>
  )
}
