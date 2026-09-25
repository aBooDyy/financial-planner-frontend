import { cn } from '#/lib/utils'

type Props = {
  step: number
  total: number
  className?: string
}

/** One segment per step, filled up to and including the current one. */
export function StepProgress({ step, total, className }: Props) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(step, total)}
      aria-label={`Step ${Math.min(step, total)} of ${total}`}
      className={cn('flex w-full gap-1 md:gap-[5px]', className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full md:h-[5px]',
            i < step ? 'bg-fp-accent' : 'bg-fp-border-strong',
          )}
        />
      ))}
    </div>
  )
}
