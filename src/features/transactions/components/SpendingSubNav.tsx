import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SPENDING_VIEWS } from '#/features/transactions/constants'
import type { SpendingView } from '#/features/transactions/constants'
import { DueCountBadge } from './DueCountBadge'
import { SPENDING_VIEW_META } from './spendingViews'

type Props = {
  view: SpendingView
  /** Planned items waiting to be confirmed, badged on the Planned tab. */
  dueCount: number
  /** Sits at the bar's end, e.g. the account filter. */
  trailing: ReactNode
}

// Mobile tab switch. It sits under the top bar so the app-wide bottom tab bar keeps its place.
export function SpendingSubNav({ view, dueCount, trailing }: Props) {
  return (
    <div className="flex flex-none items-stretch border-b border-fp-border bg-fp-surface/70 backdrop-blur-[14px] md:hidden">
      {SPENDING_VIEWS.map((v) => {
        const { label, icon: Icon } = SPENDING_VIEW_META[v]
        const isActive = v === view
        return (
          <Link
            key={v}
            to="/transactions/$view"
            params={{ view: v }}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-[3px] py-2 text-[10.5px] ${
              isActive
                ? 'font-bold text-fp-accent'
                : 'font-semibold text-fp-text-3'
            }`}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span className="max-w-full truncate">{label}</span>
            {v === 'planned' && dueCount > 0 ? (
              <DueCountBadge
                count={dueCount}
                className="absolute top-[3px] start-[calc(50%+4px)] h-4 min-w-4 px-1 text-[10px]"
              />
            ) : null}
          </Link>
        )
      })}
      <div className="flex max-w-[128px] flex-none items-center ps-1 pe-3">
        {trailing}
      </div>
    </div>
  )
}
