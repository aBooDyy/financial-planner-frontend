import type { ReactNode } from 'react'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { FundingStatus } from '#/features/goals/constants'
import { SURFACE_CARD } from './styles'

// Problem groups get a faint wash of their status colour so they stand out in the list.
const HEADER_BG: Record<FundingStatus, string> = {
  green: 'var(--fp-surface-2)',
  amber: 'rgba(217,136,43,0.09)',
  red: 'rgba(229,72,77,0.08)',
}

type Props = {
  title: string
  note: string
  // Omitted for neutral groups (e.g. completed goals).
  tone?: FundingStatus
  children: ReactNode
}

export function GoalGroupCard({ title, note, tone, children }: Props) {
  return (
    <div className={`overflow-hidden ${SURFACE_CARD}`}>
      <div
        className="flex items-center justify-between gap-[10px] border-b border-fp-border px-[14px] py-[9px]"
        style={{ background: tone ? HEADER_BG[tone] : 'var(--fp-surface-2)' }}
      >
        <span
          className="text-[11px] font-extrabold tracking-[0.05em] uppercase"
          style={{
            color: tone ? STATUS_COLORS[tone].main : 'var(--fp-text-3)',
          }}
        >
          {title}
        </span>
        <span className="text-[11.5px] whitespace-nowrap text-fp-text-3 tabular-nums">
          {note}
        </span>
      </div>
      {children}
    </div>
  )
}
