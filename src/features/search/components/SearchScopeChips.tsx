import type { ReactNode } from 'react'
import { SPENDING_VIEW_META } from '#/features/transactions/components/spendingViews'
import type { SearchContext } from '#/features/search/data/types'
import { SearchChip } from './SearchChip'

type Props = {
  context: SearchContext | null
  wide: boolean
  onWide: (wide: boolean) => void
  /** Sits at the row's end — the Filters button. */
  trailing: ReactNode
}

/** Where to search: the tab and accounts on screen, or everywhere. */
export function SearchScopeChips({ context, wide, onWide, trailing }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {context ? (
        <SearchChip active={!wide} onClick={() => onWide(false)}>
          <span className="truncate">
            {SPENDING_VIEW_META[context.view].label} · {context.scopeLabel}
          </span>
        </SearchChip>
      ) : null}
      <SearchChip active={wide || !context} onClick={() => onWide(true)}>
        Everywhere
      </SearchChip>
      {trailing}
    </div>
  )
}
