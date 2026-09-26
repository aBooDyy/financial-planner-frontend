import { ChevronRight } from 'lucide-react'
import { Icon } from '#/components/icons/Icon'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { QuickChip } from '#/features/transactions/data/quickChips'
import { TxChip } from './TxChip'

type Props = {
  chips: ReadonlyArray<QuickChip>
  category: string
  subcategory: string | null
  onChange: (category: string, subcategory: string | null) => void
  onAll: () => void
}

const same = (a: QuickChip, b: QuickChip) =>
  a.category === b.category && a.subcategory === b.subcategory

/** The categories the user reaches for most, the chosen one always among them, then the full list. */
export function TxCategoryChips({
  chips,
  category,
  subcategory,
  onChange,
  onAll,
}: Props) {
  const catalog = useCategoryCatalog()
  const chosen: QuickChip = { category, subcategory }
  const shown = chips.some((c) => same(c, chosen)) ? chips : [chosen, ...chips]

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((chip) => {
        const parent = catalog.get(chip.category)
        const sub = catalog.sub(chip.category, chip.subcategory)
        return (
          <TxChip
            key={`${chip.category}/${chip.subcategory ?? ''}`}
            active={same(chip, chosen)}
            color={parent.color}
            title={catalog.labelOf(chip.category, sub?.slug ?? null)}
            onClick={() => onChange(chip.category, chip.subcategory)}
          >
            <span style={{ color: sub?.color ?? parent.color }}>
              <Icon id={sub?.icon ?? parent.icon} size={15} />
            </span>
            <span className="truncate">{sub?.name ?? parent.name}</span>
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
