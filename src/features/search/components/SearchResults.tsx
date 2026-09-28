import { ArrowRight } from 'lucide-react'
import type { SearchResultRow, SearchView } from '#/features/search/data/types'
import { SearchResultGroup } from './SearchResultGroup'

type Props = {
  view: SearchView
  onOpen: (row: SearchResultRow) => void
  onWiden: () => void
}

const NOTE = 'px-4 py-7 text-center text-[13.5px] leading-[1.5] text-fp-text-3'

/** What the query and filters found, or what searching here would cover. */
export function SearchResults({ view, onOpen, onWiden }: Props) {
  if (view.idle) return <p className={NOTE}>{view.idleText}</p>

  const more = view.moreElsewhere

  return (
    <div>
      <p role="status" className="px-4 pt-3 pb-2 text-[12.5px] text-fp-text-3">
        {view.headline} · {view.scopeNote}
      </p>
      {view.groups.map((group) => (
        <SearchResultGroup key={group.key} group={group} onOpen={onOpen} />
      ))}
      {more > 0 ? (
        <button
          type="button"
          onClick={onWiden}
          className="flex w-full items-center gap-[6px] px-4 py-[14px] text-start text-[13px] font-bold text-fp-accent-ink"
        >
          {more} more match{more === 1 ? '' : 'es'} in other tabs and accounts
          <ArrowRight
            size={14}
            strokeWidth={2.2}
            aria-hidden
            className="rtl:-scale-x-100"
          />
        </button>
      ) : null}
      {view.empty ? (
        <p className={NOTE}>
          Nothing matches. Try a payee, category, account or amount.
        </p>
      ) : null}
    </div>
  )
}
