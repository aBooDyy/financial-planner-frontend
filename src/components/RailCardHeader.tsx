import type { ReactNode } from 'react'

type Props = {
  title: string
  sub: string
  /** Sits at the header's end, e.g. a "See all" link. */
  action?: ReactNode
}

export function RailCardHeader({ title, sub, action }: Props) {
  return (
    <div className="mb-[14px] flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] text-[14px] font-bold">{title}</div>
        <div className="text-[12px] text-fp-text-3">{sub}</div>
      </div>
      {action}
    </div>
  )
}
