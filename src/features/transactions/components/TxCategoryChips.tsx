import { ChevronRight } from 'lucide-react'
import { Icon } from '#/components/icons/Icon'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { QuickChip } from '#/features/transactions/data/quickChips'
import { TxChip } from './TxChip'

type Props = {
  chips: ReadonlyArray<QuickChip>
  /** The picked leaf's id. */
  categoryId: string
  onChange: (categoryId: string) => void
  onAll: () => void
}

/** The categories the user reaches for most, the chosen one always among them, then the full list. */
export function TxCategoryChips({ chips, categoryId, onChange, onAll }: Props) {
  const catalog = useCategoryCatalog()
  const shown: ReadonlyArray<QuickChip> = chips.some(
    (c) => c.categoryId === categoryId,
  )
    ? chips
    : [{ categoryId }, ...chips]

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((chip) => {
        const entry = catalog.get(chip.categoryId)
        return (
          <TxChip
            key={chip.categoryId}
            active={chip.categoryId === categoryId}
            color={catalog.rootOf(chip.categoryId).color}
            title={catalog.labelOf(chip.categoryId)}
            onClick={() => onChange(chip.categoryId)}
          >
            <span style={{ color: entry.color }}>
              <Icon id={entry.icon} size={15} />
            </span>
            <span className="truncate">{entry.name}</span>
          </TxChip>
        )
      })}
      <button
        type="button"
        onClick={onAll}
        className="flex items-center gap-1 rounded-full border-[1.5px] border-dashed border-fp-border-strong px-3 py-2 text-[13.5px] font-bold text-fp-text-2 transition hover:border-fp-text-3 hover:text-fp-text"
      >
        All categories
        <ChevronRight
          size={14}
          strokeWidth={2.2}
          className="rtl:-scale-x-100"
        />
      </button>
    </div>
  )
}
