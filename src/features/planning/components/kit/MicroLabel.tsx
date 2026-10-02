import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** The small uppercase label over a group ("HELD IN", "UNTIL PAYDAY"). */
export function MicroLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-[11px] font-extrabold tracking-[0.065em] text-fp-text-3 uppercase',
        className,
      )}
    >
      {children}
    </div>
  )
}
