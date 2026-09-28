import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  active: boolean
  onClick: () => void
  /** A picked chip wears this colour (a subcategory its root's); the accent otherwise. */
  color?: string
  size?: 'md' | 'sm'
  children: ReactNode
}

/** A one-tap pick in the search sheet: a scope, a date range, a category, an account. */
export function SearchChip({
  active,
  onClick,
  color,
  size = 'md',
  children,
}: Props) {
  const tinted = active && color !== undefined

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-[6px] rounded-full border whitespace-nowrap transition-colors',
        size === 'md'
          ? 'px-[11px] py-[6px] text-[12.5px]'
          : 'px-[10px] py-1 text-[12px]',
        !active &&
          'border-fp-border bg-fp-surface font-semibold text-fp-text-2 hover:border-fp-border-strong',
        active &&
          !tinted &&
          'border-fp-accent bg-fp-accent-soft font-bold text-fp-accent-ink',
        tinted && 'font-bold text-fp-text',
      )}
      style={
        tinted
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
