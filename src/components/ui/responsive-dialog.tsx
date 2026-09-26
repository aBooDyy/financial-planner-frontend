import type { ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'
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

export type DialogTone = 'danger' | 'warn' | 'accent' | 'neutral'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** The line under the title; falls back to a visually-hidden copy of the title. */
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Desktop width override (e.g. `sm:max-w-[560px]`). */
  contentClassName?: string
  bodyClassName?: string
  /** Mobile sheet override (e.g. a full-height sheet for a dense editor). */
  sheetClassName?: string
  /** `false` removes every way to close it except the footer's own buttons. */
  dismissible?: boolean
  /** Shows a back button before the title in place of close, for a sub-view of the dialog. */
  onBack?: () => void
  /**
   * Turns it into an alert (a confirmation or a warning): the icon in a tinted circle above
   * the title, no close button, and footer buttons that share the width.
   */
  icon?: ReactNode
  tone?: DialogTone
  /** Keeps the title for screen readers only, for a body that carries its own heading. */
  hideHeader?: boolean
}

const CLOSE =
  'flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-fp-surface-2 text-fp-text-2 transition outline-none hover:text-fp-text focus-visible:ring-[3px] focus-visible:ring-fp-accent/30'

const TITLE =
  'text-[18px] leading-[1.3] font-extrabold tracking-[-0.01em] text-pretty text-fp-text'

const SUBTITLE =
  'mt-[3px] text-[13px] leading-[1.45] text-pretty text-fp-text-2'

const TONE: Record<DialogTone, string> = {
  danger: 'bg-fp-danger/10 text-fp-danger',
  warn: 'bg-fp-spend-soft text-fp-spend',
  accent: 'bg-fp-accent-soft text-fp-accent-ink',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} aria-label="Back" className={CLOSE}>
      <ChevronLeft size={17} strokeWidth={2.2} className="rtl:-scale-x-100" />
    </button>
  )
}

type Parts = {
  Title: typeof DialogTitle | typeof DrawerTitle
  Description: typeof DialogDescription | typeof DrawerDescription
  Close: typeof DialogClose | typeof DrawerClose
}

type BodyProps = Omit<
  Props,
  'open' | 'onOpenChange' | 'contentClassName' | 'sheetClassName'
> &
  Parts

/** Header, scrollable body and pinned footer: the same on the desktop dialog and the sheet. */
function DialogChrome({
  Title,
  Description,
  Close,
  title,
  description,
  children,
  footer,
  bodyClassName,
  dismissible = true,
  onBack,
  icon,
  tone = 'neutral',
  hideHeader,
}: BodyProps) {
  const alert = icon !== undefined
  const showClose = dismissible && !onBack && !alert
  const descriptionNode = (
    <Description className={description ? SUBTITLE : 'sr-only'}>
      {description ?? title}
    </Description>
  )

  return (
    <>
      {hideHeader ? (
        <div className="sr-only">
          <Title>{title}</Title>
          {descriptionNode}
        </div>
      ) : alert ? (
        <div className="flex flex-col gap-3 px-[22px] pt-[22px]">
          <span
            aria-hidden
            className={cn(
              'flex size-[42px] items-center justify-center rounded-full [&_svg]:size-[19px]',
              TONE[tone],
            )}
          >
            {icon}
          </span>
          <div>
            <Title className={TITLE}>{title}</Title>
            {descriptionNode}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-[10px] px-5 pt-[18px]">
          {onBack ? <BackButton onBack={onBack} /> : null}
          <div className="min-w-0 flex-1">
            <Title className={cn(TITLE, 'truncate')}>{title}</Title>
            {descriptionNode}
          </div>
          {showClose ? (
            <Close className={CLOSE} aria-label="Close">
              <X size={17} strokeWidth={2} />
            </Close>
          ) : null}
        </div>
      )}
      <div
        className={cn(
          'flex min-h-0 flex-col gap-[14px] overflow-y-auto',
          alert
            ? 'px-[22px] pt-[10px] pb-1 text-[13.5px] leading-[1.55] text-fp-text-2'
            : 'px-5 pt-4 pb-[18px]',
          hideHeader && 'pt-0',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div
          className={cn(
            'flex flex-none items-center gap-2',
            alert
              ? 'px-[22px] pt-4 pb-5 *:flex-1'
              : 'border-t border-fp-border px-5 pt-3 pb-[18px]',
          )}
        >
          {footer}
        </div>
      ) : null}
    </>
  )
}

/**
 * One modal primitive for the whole app: a centered Dialog on desktop and a vaul
 * bottom-sheet Drawer on mobile, sharing the Means editor chrome (title + subtitle + close,
 * scrollable body, pinned footer). Controlled via `open` / `onOpenChange`.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  contentClassName,
  sheetClassName,
  ...chrome
}: Props) {
  const { dismissible = true, icon } = chrome
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
            'flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[20px] border-fp-border bg-fp-surface p-0 shadow-[0_1px_2px_rgba(20,18,12,0.05),0_30px_60px_-24px_rgba(20,18,12,0.35)] sm:max-w-[470px]',
            icon !== undefined && 'sm:max-w-[420px]',
            contentClassName,
          )}
        >
          <DialogChrome
            {...chrome}
            Title={DialogTitle}
            Description={DialogDescription}
            Close={DialogClose}
          />
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
        <DialogChrome
          {...chrome}
          Title={DrawerTitle}
          Description={DrawerDescription}
          Close={DrawerClose}
        />
      </DrawerContent>
    </Drawer>
  )
}
