type Props = {
  /** Matches for the current search; null while nothing is being searched. */
  total: number | null
  onClear: () => void
  onDone: () => void
}

export function FilterPanelFooter({ total, onClear, onDone }: Props) {
  return (
    <div className="flex items-center gap-[10px] pt-[2px]">
      <button
        type="button"
        onClick={onClear}
        className="rounded-[10px] border border-fp-border-strong bg-fp-surface px-3 py-[10px] text-[13px] font-bold text-fp-text-2 hover:text-fp-text"
      >
        Clear all
      </button>
      <button
        type="button"
        onClick={onDone}
        className="max-w-[220px] flex-1 rounded-[10px] bg-primary px-[14px] py-[10px] text-[13px] font-bold text-primary-foreground hover:brightness-105"
      >
        {total === null
          ? 'Done'
          : `Show ${total} result${total === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}
