import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export type ChipTone = 'ok' | 'warn' | 'danger' | 'blue' | 'goal' | 'neutral'

const TONE: Record<ChipTone, string> = {
  ok: 'bg-fp-accent-soft text-fp-accent-ink',
  warn: 'bg-fp-warn-soft text-fp-warn',
  danger: 'bg-fp-danger-soft text-fp-danger',
  blue: 'bg-fp-transfer-soft text-fp-transfer',
  goal: 'bg-fp-goal-soft text-fp-goal',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

/** A short state word on a pill ("Covered", "Behind by SR 200"). */
export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: ChipTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-full px-2 py-[2px] text-[11px] font-bold whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
