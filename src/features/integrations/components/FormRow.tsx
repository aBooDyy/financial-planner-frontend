import type { ReactNode } from 'react'
import { Label } from '#/components/ui/label'

type Props = {
  id: string
  label: string
  error?: string | null
  help?: string
  children: ReactNode
}

/** A labelled control with its help or error line beneath, announced when it changes. */
export function FormRow({ id, label, error, help, children }: Props) {
  return (
    <div className="flex flex-col">
      <Label
        htmlFor={id}
        className="mb-[6px] text-[12.5px] font-semibold text-fp-text-2"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-fp-danger">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-[12px] text-fp-text-3">{help}</p>
      ) : null}
    </div>
  )
}
