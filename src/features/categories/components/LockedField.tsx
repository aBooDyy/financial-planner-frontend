import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { FIELD_WELL } from '#/components/ui/field-well'
import { cn } from '#/lib/utils'

type Props = {
  label: string
  /** Before the value in place of the lock, e.g. the parent's icon. */
  leading?: ReactNode
  children: ReactNode
}

/** A value shown in its field's well that can't be changed here; the reason goes beneath. */
export function LockedField({ label, leading, children }: Props) {
  return (
    <div
      role="group"
      aria-label={`${label} (locked)`}
      className={cn(FIELD_WELL, 'flex min-w-0 items-center gap-[10px]')}
    >
      {leading ?? (
        <Lock
          aria-hidden
          size={15}
          strokeWidth={2}
          className="flex-none text-fp-text-3"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  )
}
