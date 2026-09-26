import type { ReactNode } from 'react'

/** A question-headed block of the transaction dialog ("What for?", "When?"). */
export function TxSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-2 text-[13px] font-bold text-fp-text-2">{label}</div>
      {children}
    </div>
  )
}
