import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  active: boolean
  /** The chosen chip's colour; the accent when omitted. */
  color?: string
  title?: string
  disabled?: boolean
  /** `sm` fits a long row of short picks (five cadences) on one line. */
  size?: 'default' | 'sm'
  onClick: () => void
  children: ReactNode
}

/** A one-tap pill ("Monthly", "Today"); a chosen one wears its colour. */
export function Chip({
  active,
  color = 'var(--fp-accent-ink)',
  title,
  disabled,
  size = 'default',
  onClick,
  children,
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex max-w-full items-center gap-[7px] rounded-full border-[1.5px] whitespace-nowrap text-fp-text transition disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm'
          ? 'px-[11px] py-[6px] text-[12.5px]'
          : 'px-[13px] py-2 text-[13.5px]',
        active
          ? 'font-extrabold'
          : 'border-fp-border bg-fp-surface font-semibold hover:border-fp-border-strong',
      )}
      style={
        active
          ? {
              borderColor: color,
              background: `color-mix(in srgb, ${color} 12%, var(--fp-surface))`,
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}

/** A wrapping row of chips answering one question. */
export function ChipRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {children}
    </div>
  )
}
