import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SPENDING_VIEWS } from '#/features/transactions/constants'
import type { SpendingView } from '#/features/transactions/constants'
import { SPENDING_VIEW_META } from './spendingViews'

type Props = {
  view: SpendingView
  /** Sits at the card's end, e.g. the account filter. */
  trailing: ReactNode
}

// Desktop tab switch: a card at the top of the content column, like the Goals section tabs.
export function SpendingTabCard({ view, trailing }: Props) {
  return (
    <div className="hidden min-w-0 items-stretch gap-[22px] rounded-[14px] border border-fp-border bg-fp-surface ps-4 pe-[10px] shadow-fp md:flex">
      {SPENDING_VIEWS.map((v) => {
        const isActive = v === view
        return (
          <Link
            key={v}
            to="/transactions/$view"
            params={{ view: v }}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-12 flex-none items-center gap-[6px] text-[14px] whitespace-nowrap ${
              isActive
                ? 'font-bold text-fp-text shadow-[inset_0_-2px_0_var(--fp-accent)]'
                : 'font-medium text-fp-text-3 hover:text-fp-text-2'
            }`}
          >
            {SPENDING_VIEW_META[v].label}
          </Link>
        )
      })}
      <div className="ms-auto flex min-w-0 items-center">{trailing}</div>
    </div>
  )
}
