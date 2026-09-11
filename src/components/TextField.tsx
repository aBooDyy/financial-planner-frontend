import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, id, className, ...rest },
  ref,
) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="mb-[7px] text-[12.5px] font-semibold text-fp-text-2"
      >
        {label}
      </Label>
      <Input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={className}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] text-fp-danger">{error}</p>
      ) : null}
    </div>
  )
})
