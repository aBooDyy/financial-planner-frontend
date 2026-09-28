import { Search } from 'lucide-react'
import { searchShortcutHint } from '#/features/search/hooks/useSearchShortcut'
import { useSearchStore } from '#/features/search/stores/search'

const WIDE =
  'hidden h-[34px] w-[210px] items-center gap-2 rounded-[10px] border border-fp-border bg-fp-surface px-[11px] text-[13px] text-fp-text-3 transition-colors hover:border-fp-border-strong md:inline-flex'
const ICON =
  'flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-fp-border bg-fp-surface text-fp-text-2 hover:text-fp-text md:hidden'

/** The top bar's way into search: a wide field-like button on desktop, an icon on mobile. */
export function SearchTrigger() {
  const openSearch = useSearchStore((s) => s.openSearch)

  return (
    <>
      <button type="button" onClick={openSearch} className={WIDE}>
        <Search size={15} strokeWidth={2} aria-hidden className="flex-none" />
        <span className="flex-1 truncate text-start">Search everything</span>
        <kbd className="flex-none rounded-[5px] bg-fp-surface-2 px-[5px] py-px font-sans text-[10.5px] font-bold text-fp-text-3">
          {searchShortcutHint()}
        </kbd>
      </button>
      <button
        type="button"
        onClick={openSearch}
        title="Search"
        aria-label="Search"
        className={ICON}
      >
        <Search size={16} strokeWidth={2} aria-hidden />
      </button>
    </>
  )
}
