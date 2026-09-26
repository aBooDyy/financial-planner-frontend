import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Input } from '#/components/ui/input'
import { FieldLabel } from './FieldLabel'
import { FieldMessage } from './FormRow'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  optional?: boolean
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, optional, id, className, ...rest },
  ref,
) {
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={className}
        {...rest}
      />
      <FieldMessage error={error} />
    </div>
  )
})
