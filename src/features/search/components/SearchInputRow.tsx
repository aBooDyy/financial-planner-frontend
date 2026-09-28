import { Search } from 'lucide-react'

type Props = {
  query: string
  onQuery: (query: string) => void
  onCancel: () => void
}

/** The sheet's header: the query field and Cancel. */
export function SearchInputRow({ query, onQuery, onCancel }: Props) {
  return (
    <div className="flex h-[54px] flex-none items-center gap-[10px] border-b border-fp-border ps-4 pe-3">
      <Search
        size={18}
        strokeWidth={2}
        aria-hidden
        className="flex-none text-fp-text-3"
      />
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search transactions, budgets, recurring, accounts"
        aria-label="Search"
        autoComplete="off"
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-fp-text outline-none placeholder:text-fp-text-3"
      />
      <button
        type="button"
        onClick={onCancel}
        className="flex-none rounded-[9px] bg-fp-surface-2 px-[10px] py-[7px] text-[12.5px] font-bold text-fp-text-2 hover:text-fp-text"
      >
        Cancel
      </button>
    </div>
  )
}
