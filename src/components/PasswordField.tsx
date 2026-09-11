import { forwardRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
  headerAction?: ReactNode
  footer?: ReactNode
}

export const PasswordField = forwardRef<HTMLInputElement, Props>(
  function PasswordField(
    { label, error, headerAction, footer, id, className, ...rest },
    ref,
  ) {
    const [show, setShow] = useState(false)

    return (
      <div>
        <div className="mb-[7px] flex items-center justify-between">
          <Label
            htmlFor={id}
            className="text-[12.5px] font-semibold text-fp-text-2"
          >
            {label}
          </Label>
          {headerAction}
        </div>
        <div className="relative">
          <Input
            id={id}
            ref={ref}
            type={show ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            className={`pe-11 ${className ?? ''}`}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-fp-text-3 hover:text-fp-text-2"
          >
            {show ? (
              <EyeOff size={18} strokeWidth={1.8} />
            ) : (
              <Eye size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
        {footer}
        {error ? (
          <p className="mt-1.5 text-[12px] text-fp-danger">{error}</p>
        ) : null}
      </div>
    )
  },
)
