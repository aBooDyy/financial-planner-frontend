import type { ReactNode } from 'react'
import { CloudOff } from 'lucide-react'
import { cn } from '#/lib/utils'

/** The standard reason beside a control that needs the server, for a string-only slot. */
export const OFFLINE_HINT = 'Available when you’re back online.'

type Props = {
  children?: ReactNode
  className?: string
}

/**
 * Why something that needs the server is off right now. Plain helper text rather than a
 * tooltip, so it reads the same on touch. Callers render it only while offline.
 */
export function OfflineNotice({ children = OFFLINE_HINT, className }: Props) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 text-[12.5px] leading-[1.45] text-fp-text-2',
        className,
      )}
    >
      <CloudOff
        size={15}
        strokeWidth={1.8}
        aria-hidden
        className="mt-px shrink-0"
      />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
