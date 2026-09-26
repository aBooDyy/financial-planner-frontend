import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** A question-headed block of the transaction dialog ("What for?", "When?"). */
export function TxSection({
  label,
  invalid = false,
  children,
}: {
  label: string
  /** Marks the block a refused sync pointed at. */
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label} data-invalid={invalid || undefined}>
      <div
        className={cn(
          'mb-2 text-[13px] font-bold',
          invalid ? 'text-fp-danger' : 'text-fp-text-2',
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          invalid &&
            'rounded-[14px] outline-[1.5px] outline-offset-[3px] outline-fp-danger/70 outline-solid',
        )}
      >
        {children}
      </div>
    </div>
  )
}
