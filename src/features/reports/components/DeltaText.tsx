import { ChevronsUpDown } from 'lucide-react'
import type { Delta, Tone } from '#/features/reports/data/delta'
import { cn } from '#/lib/utils'

const TONE: Record<Tone, string> = {
  good: 'text-fp-accent-ink',
  bad: 'text-fp-danger',
  neutral: 'text-fp-text-2',
}

const NO_BASE_HINT = 'Nothing in the comparison period to compare with'

type Props = {
  delta: Delta
  className?: string
}

/** A change against the comparison period, coloured by whether it is welcome. */
export function DeltaText({ delta, className }: Props) {
  return (
    <span
      title={delta.noBase ? NO_BASE_HINT : undefined}
      aria-label={delta.noBase ? NO_BASE_HINT : undefined}
      className={cn(
        'inline-flex items-center gap-[2px] font-bold whitespace-nowrap',
        TONE[delta.tone],
        className,
      )}
    >
      {delta.noBase ? (
        <ChevronsUpDown
          aria-hidden
          className="size-[1.05em]"
          strokeWidth={2.4}
        />
      ) : null}
      {delta.text}
    </span>
  )
}
