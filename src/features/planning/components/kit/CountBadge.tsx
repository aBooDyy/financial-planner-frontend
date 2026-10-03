import { cn } from '#/lib/utils'

/** A small solid count on a tab: warn for things to confirm, danger for decisions. */
export function CountBadge({
  count,
  tone,
  label,
  className,
}: {
  count: number
  tone: 'warn' | 'danger' | 'accent'
  label: string
  className?: string
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-extrabold tabular-nums',
        tone === 'warn' && 'bg-fp-warn-fill text-fp-on-warn-fill',
        tone === 'danger' && 'bg-fp-danger-fill text-fp-on-danger-fill',
        tone === 'accent' && 'bg-fp-accent text-white',
        className,
      )}
    >
      {count}
    </span>
  )
}
