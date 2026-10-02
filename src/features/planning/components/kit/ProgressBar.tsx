import { cn } from '#/lib/utils'

/** A thin progress track: `value` of `max`, filled in `color`. */
export function ProgressBar({
  value,
  max,
  color,
  className,
  label,
}: {
  value: number
  max: number
  color: string
  className?: string
  label?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        'h-[6px] overflow-hidden rounded-full bg-fp-surface-2',
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}
