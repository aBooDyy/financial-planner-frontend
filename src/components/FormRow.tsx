import type { ReactNode } from 'react'
import { FieldLabel } from './FieldLabel'

type Props = {
  id: string
  label: string
  error?: string | null
  help?: string
  optional?: boolean
  children: ReactNode
}

/** A labelled control with its help or error line beneath, announced when it changes. */
export function FormRow({ id, label, error, help, optional, children }: Props) {
  return (
    <div className="flex min-w-0 flex-col">
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      {children}
      <FieldMessage error={error} help={help} />
    </div>
  )
}

/** The line under a field: its error when there is one, else its help. */
export function FieldMessage({
  error,
  help,
}: {
  error?: string | null
  help?: ReactNode
}) {
  if (error)
    return (
      <p
        role="alert"
        className="mt-[7px] text-[12px] leading-[1.45] font-semibold text-fp-danger"
      >
        {error}
      </p>
    )
  if (help)
    return (
      <p className="mt-[7px] text-[12px] leading-[1.45] font-medium text-fp-text-3">
        {help}
      </p>
    )
  return null
}
