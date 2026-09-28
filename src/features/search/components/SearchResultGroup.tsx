import type {
  SearchGroup,
  SearchResultRow as Row,
} from '#/features/search/data/types'
import { SearchResultRow } from './SearchResultRow'

type Props = {
  group: SearchGroup
  onOpen: (row: Row) => void
}

/** One kind of result under its heading and match count. */
export function SearchResultGroup({ group, onOpen }: Props) {
  return (
    <section aria-label={group.title}>
      <div className="flex justify-between bg-fp-surface-2 px-4 pt-[9px] pb-[6px] text-[11px] font-bold tracking-[0.06em] text-fp-text-3 uppercase">
        <span>{group.title}</span>
        <span className="tabular-nums">{group.count}</span>
      </div>
      {group.rows.map((row) => (
        <SearchResultRow key={row.key} row={row} onOpen={onOpen} />
      ))}
    </section>
  )
}
