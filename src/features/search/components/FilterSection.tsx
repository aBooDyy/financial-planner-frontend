import type { ReactNode } from 'react'

/** One labelled block of the filter panel. */
export function FilterSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-[7px]">
      <span className="text-[11px] font-bold tracking-[0.06em] text-fp-text-3 uppercase">
        {label}
      </span>
      {children}
    </section>
  )
}
