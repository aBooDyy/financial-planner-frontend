import { ListFilter } from 'lucide-react'
import { cn } from '#/lib/utils'

type Props = {
  open: boolean
  count: number
  onToggle: () => void
}

/** Opens and closes the filter panel; the badge counts the filters in force. */
export function SearchFiltersButton({ open, count, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
      className={cn(
        'ms-auto inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[6px] text-[12.5px] font-bold',
        open
          ? 'border-fp-text bg-fp-text text-fp-surface'
          : count > 0
            ? 'border-fp-text bg-fp-surface text-fp-text'
            : 'border-fp-border bg-fp-surface text-fp-text',
      )}
    >
      <ListFilter size={14} strokeWidth={2} aria-hidden />
      <span>Filters</span>
      {count > 0 ? (
        <span
          aria-hidden
          className={cn(
            'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-extrabold',
            open
              ? 'bg-fp-surface text-fp-text'
              : 'bg-primary text-primary-foreground',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}
