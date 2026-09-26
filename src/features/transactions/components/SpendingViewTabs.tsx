import { Link } from '@tanstack/react-router'
import { SPENDING_VIEWS } from '#/features/transactions/constants'
import type { SpendingView } from '#/features/transactions/constants'

const viewSeg = (active: boolean) =>
  `inline-flex flex-1 items-center justify-center gap-[6px] rounded-[10px] px-2 py-2 text-[13px] md:flex-none md:px-4 md:text-[13.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

type Props = {
  view: SpendingView
  /** Planned items waiting to be confirmed, badged on the Planned tab. */
  dueCount: number
}

/** The Spending page's tab strip — one link per `/transactions/<view>` route. */
export function SpendingViewTabs({ view, dueCount }: Props) {
  return (
    <div className="flex w-full rounded-[13px] border border-fp-border bg-fp-surface-2 p-[3px] md:inline-flex md:w-auto">
      {SPENDING_VIEWS.map((v) => (
        <Link
          key={v}
          to="/transactions/$view"
          params={{ view: v }}
          aria-current={view === v ? 'page' : undefined}
          className={viewSeg(view === v)}
        >
          {v[0].toUpperCase() + v.slice(1)}
          {v === 'planned' && dueCount > 0 ? (
            <span
              aria-label={`${dueCount} need confirming`}
              className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fp-warn px-[5px] text-[10.5px] font-bold text-white"
            >
              {dueCount}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  )
}
