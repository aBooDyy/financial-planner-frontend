import { cn } from '#/lib/utils'

export type TagTone = 'accent' | 'neutral'

type Props = {
  label: string
  tone?: TagTone
  /** A dashed outline instead of a fill — for something that has not happened yet. */
  dashed?: boolean
  className?: string
}

const TONE: Record<TagTone, string> = {
  accent: 'border-transparent bg-fp-accent-soft text-fp-accent-ink',
  neutral: 'border-fp-border bg-fp-surface-2 text-fp-text-2',
}

/** A small pill naming what a row is ("Goal", "Obligation", "Income"). */
export function TagPill({ label, tone = 'neutral', dashed, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center rounded-full border px-[7px] py-px text-[10px] leading-[1.5] font-bold',
        dashed
          ? 'border-dashed border-fp-border-strong bg-transparent text-fp-text-3'
          : TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}
