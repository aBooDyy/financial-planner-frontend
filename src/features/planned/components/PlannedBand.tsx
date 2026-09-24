import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  title: string
  caption?: ReactNode
  /** `due`: amber — something waits on the user. */
  tone?: 'due' | 'neutral'
}

/** A section header inside the Planned card: "Needs confirming · 2" … "Not in balances yet". */
export function PlannedBand({ title, caption, tone = 'neutral' }: Props) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2 px-4 pt-[11px] pb-[7px]',
        tone === 'due' ? 'bg-fp-warn/10' : 'bg-fp-surface-2',
      )}
    >
      <span
        className={cn(
          'text-[12px] font-bold',
          tone === 'due' ? 'text-fp-warn' : 'text-fp-text-2',
        )}
      >
        {title}
      </span>
      {caption ? (
        <span
          className={cn(
            'text-[12px] tabular-nums',
            tone === 'due' ? 'text-fp-warn/80' : 'text-fp-text-3',
          )}
        >
          {caption}
        </span>
      ) : null}
    </div>
  )
}
