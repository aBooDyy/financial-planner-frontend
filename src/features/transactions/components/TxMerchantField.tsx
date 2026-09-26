import { Search, Sparkles } from 'lucide-react'
import { cn } from '#/lib/utils'

type Props = {
  name: string
  onOpen: () => void
  /** The merchant's learned category, offered but not applied; null when there is none. */
  suggestion: string | null
  onApplySuggestion: () => void
}

/** Who was paid, opening the merchant search; a learned category is offered beneath it. */
export function TxMerchantField({
  name,
  onOpen,
  suggestion,
  onApplySuggestion,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={name ? `Merchant: ${name}` : 'Merchant'}
        className="flex w-full items-center gap-[10px] rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface-2 px-[14px] py-[13px] text-start transition hover:border-fp-border-strong"
      >
        <Search
          size={16}
          strokeWidth={2.2}
          className="flex-none text-fp-text-3"
        />
        <span
          className={cn(
            'truncate text-[14px]',
            name ? 'font-bold text-fp-text' : 'font-medium text-fp-text-3',
          )}
        >
          {name || 'Search or add a merchant…'}
        </span>
      </button>
      {suggestion ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-[5px] text-[12.5px] font-semibold text-fp-accent-ink">
            <Sparkles size={13} className="flex-none" />
            Usually {suggestion}
          </span>
          <button
            type="button"
            onClick={onApplySuggestion}
            className="rounded-full bg-fp-accent-soft px-[11px] py-[5px] text-[12px] font-bold text-fp-accent-ink"
          >
            Use it
          </button>
        </div>
      ) : null}
    </>
  )
}
