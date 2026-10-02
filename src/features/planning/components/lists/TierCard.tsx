import type { ReactNode } from 'react'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'

type Props = {
  title: string
  /** "SR 1,250 a paycheck". */
  note?: string
  children: ReactNode
}

/** One priority tier ("Must pay", "Nice to have"): a card of draggable rows. */
export function TierCard({ title, note, children }: Props) {
  return (
    <PlanCard label={title} className="overflow-hidden">
      <div className="flex items-baseline gap-3 px-4 pt-3 pb-[10px]">
        <h3 className="text-[15px] font-extrabold tracking-[-0.01em]">
          {title}
        </h3>
        {note ? (
          <span className="fp-sensitive text-[12px] text-fp-text-3">
            {note}
          </span>
        ) : null}
        <span className="ms-auto hidden text-[11.5px] font-semibold text-fp-text-3 md:inline">
          Drag to reorder
        </span>
      </div>
      <ul>{children}</ul>
    </PlanCard>
  )
}
