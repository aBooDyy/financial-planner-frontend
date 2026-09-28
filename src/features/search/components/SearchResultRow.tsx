import { cn } from '#/lib/utils'
import type { SearchResultRow as Row } from '#/features/search/data/types'
import { SearchResultIcon } from './SearchResultIcon'

type Props = {
  row: Row
  onOpen: (row: Row) => void
}

export function SearchResultRow({ row, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="flex w-full items-center gap-3 border-b border-fp-border px-4 py-[10px] text-start hover:bg-fp-surface-2 focus-visible:bg-fp-surface-2 focus-visible:outline-none"
    >
      <SearchResultIcon row={row} />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[14px] font-semibold text-fp-text">
          {row.title}
        </span>
        <span className="truncate text-[12px] text-fp-text-3">{row.sub}</span>
      </span>
      <span
        className={cn(
          'flex-none text-[14px] font-bold whitespace-nowrap tabular-nums',
          row.positive ? 'text-fp-accent-ink' : 'text-fp-text',
        )}
      >
        {row.valueStr}
      </span>
    </button>
  )
}
