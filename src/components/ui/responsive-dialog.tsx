import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '#/components/ui/drawer'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** Accessible description; falls back to a visually-hidden copy of the title. */
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Desktop width override (e.g. `sm:max-w-[560px]`). */
  contentClassName?: string
  bodyClassName?: string
  /** Mobile sheet override (e.g. a full-height sheet for a dense editor). */
  sheetClassName?: string
  /** `false` removes every way to close it except the footer's own buttons. */
  dismissible?: boolean
}

const CLOSE =
  'flex h-8 w-8 items-center justify-center rounded-[9px] bg-fp-surface-2 text-fp-text-2 transition hover:text-fp-text'

/**
 * One modal primitive for the whole app: a centered Dialog on desktop and a vaul
 * bottom-sheet Drawer on mobile, sharing the Means editor chrome (title + close,
 * scrollable body, pinned footer). Controlled via `open` / `onOpenChange`.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  bodyClassName,
  sheetClassName,
  dismissible = true,
}: Props) {
  const isDesktop = useIsDesktop()
  const holdOpen = (event: Event) => {
    if (!dismissible) event.preventDefault()
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={holdOpen}
          onInteractOutside={holdOpen}
          className={cn(
            'flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[20px] border-fp-border bg-fp-surface p-0 shadow-fp sm:max-w-[470px]',
            contentClassName,
          )}
        >
          <div className="flex items-center justify-between p-6 pb-4">
            <DialogTitle className="text-[18px] font-extrabold tracking-[-0.01em] text-fp-text">
              {title}
            </DialogTitle>
            {dismissible ? (
              <DialogClose className={CLOSE} aria-label="Close">
                <X size={17} strokeWidth={2} />
              </DialogClose>
            ) : null}
          </div>
          <DialogDescription
            className={description ? 'px-6 text-fp-text-2' : 'sr-only'}
          >
            {description ?? title}
          </DialogDescription>
          <div className={cn('overflow-y-auto px-6 pt-1 pb-2', bodyClassName)}>
            {children}
          </div>
          {footer ? (
            <div className="flex items-center gap-[10px] p-6 pt-4">
              {footer}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
      <DrawerContent
        className={cn(
          'max-h-[92%] border-fp-border bg-fp-surface',
          sheetClassName,
        )}
      >
        <div className="flex items-center justify-between px-[18px] pt-1 pb-3">
          <DrawerTitle className="text-[18px] font-extrabold tracking-[-0.01em] text-fp-text">
            {title}
          </DrawerTitle>
          {dismissible ? (
            <DrawerClose className={CLOSE} aria-label="Close">
              <X size={17} strokeWidth={2} />
            </DrawerClose>
          ) : null}
        </div>
        <DrawerDescription
          className={description ? 'px-[18px] text-fp-text-2' : 'sr-only'}
        >
          {description ?? title}
        </DrawerDescription>
        <div
          className={cn('overflow-y-auto px-[18px] pt-1 pb-2', bodyClassName)}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex items-center gap-[10px] px-[18px] pt-4 pb-6">
            {footer}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}
