import { cn } from '#/lib/utils'

/** The border and fill every pickable card shares: accent-tinted when chosen. */
export const selectableCard = (on: boolean, className?: string) =>
  cn(
    'cursor-pointer border-[1.5px] text-start text-fp-text transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/25',
    on
      ? 'border-fp-accent bg-fp-accent-soft'
      : 'border-fp-border bg-fp-surface hover:border-fp-text-3',
    className,
  )
