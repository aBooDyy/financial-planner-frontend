import type { ReactNode } from 'react'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

type Props = {
  htmlFor?: string
  optional?: boolean
  className?: string
  children: ReactNode
}

/** A dialog field's question ("How often?"), with a quiet "optional" after it when it is. */
export function FieldLabel({ htmlFor, optional, className, children }: Props) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn(
        'mb-2 gap-1 text-[13px] leading-snug font-bold text-fp-text-2',
        className,
      )}
    >
      {children}
      {optional ? (
        <span className="font-medium text-fp-text-3">optional</span>
      ) : null}
    </Label>
  )
}
