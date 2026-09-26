import type { ReactNode } from 'react'
import { Archive, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { DialogTone } from '#/components/ui/responsive-dialog'
import { NoteBox } from './NoteBox'

type ConfirmVariant = 'destructive' | 'danger-soft' | 'default'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** The consequences, one per line. */
  bullets?: ReadonlyArray<ReactNode>
  /** Plain copy in place of (or before) the bullets. */
  children?: ReactNode
  /** A quiet boxed aside under the copy ("Restore it anytime from Settings › Archived."). */
  note?: ReactNode
  error?: string | null
  tone?: DialogTone
  icon?: ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: ConfirmVariant
  onConfirm: () => void
  /** Only the confirm button is off (nothing left to act on); Cancel still works. */
  confirmDisabled?: boolean
  busy?: boolean
  /** Desktop width override when the copy needs more room than the 420px default. */
  contentClassName?: string
}

const ICON: Record<DialogTone, ReactNode> = {
  danger: <Trash2 />,
  warn: <TriangleAlert />,
  accent: <Archive />,
  neutral: <Archive />,
}

const VARIANT: Record<DialogTone, ConfirmVariant> = {
  danger: 'destructive',
  warn: 'danger-soft',
  accent: 'default',
  neutral: 'default',
}

/**
 * Every "are you sure": a tinted icon, the question, what will happen, and two equal buttons.
 * Delete confirmations use `danger`, unsaved-changes prompts `warn`, archive `neutral`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  bullets,
  children,
  note,
  error,
  tone = 'danger',
  icon,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmVariant,
  onConfirm,
  confirmDisabled,
  busy,
  contentClassName,
}: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={icon ?? ICON[tone]}
      tone={tone}
      dismissible={!busy}
      contentClassName={contentClassName}
      footer={
        <>
          <Button
            type="button"
            variant="quiet"
            size="dialog"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant ?? VARIANT[tone]}
            size="dialog"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {bullets && bullets.length > 0 ? <BulletList items={bullets} /> : null}
      {note ? <NoteBox tone="neutral">{note}</NoteBox> : null}
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-fp-danger">
          {error}
        </p>
      ) : null}
    </ResponsiveDialog>
  )
}

export function BulletList({ items }: { items: ReadonlyArray<ReactNode> }) {
  return (
    <ul className="flex flex-col gap-[7px]">
      {items.map((item, i) => (
        <li key={i} className="flex gap-[9px]">
          <span
            aria-hidden
            className="mt-2 size-[5px] flex-none rounded-full bg-fp-text-3"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}
