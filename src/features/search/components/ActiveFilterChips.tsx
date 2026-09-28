import { X } from 'lucide-react'
import type { ActiveFilterChip } from '#/features/search/data/types'

type Props = {
  chips: ReadonlyArray<ActiveFilterChip>
  onRemove: (chip: ActiveFilterChip) => void
  onClear: () => void
}

/** The filters in force while the panel is shut, each removable on its own. */
export function ActiveFilterChips({ chips, onRemove, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip)}
          aria-label={`Remove ${chip.label}`}
          className="inline-flex max-w-full items-center gap-[5px] rounded-full bg-fp-surface-2 py-1 ps-[10px] pe-[6px] text-[12px] font-semibold text-fp-text hover:bg-fp-border"
        >
          <span className="truncate">{chip.label}</span>
          <X
            size={12}
            strokeWidth={2.4}
            aria-hidden
            className="flex-none text-fp-text-3"
          />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="px-[6px] py-1 text-[12px] font-bold text-fp-text-3 hover:text-fp-text"
      >
        Clear all
      </button>
    </div>
  )
}
