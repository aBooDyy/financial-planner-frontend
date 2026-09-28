import { Chip, ChipRow } from '#/components/dialog/Chip'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { MerchantCategories } from '#/features/inbound-imports/data/categorySuggestions'

type Props = {
  merchant: MerchantCategories
  catalog: CategoryCatalog
  selectedId: string
  onPick: (categoryId: string) => void
}

/** What the user filed this merchant under before, so a repeat is one glance (or tap) to confirm. */
export function MerchantHint({ merchant, catalog, selectedId, onPick }: Props) {
  if (merchant.categoryIds.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-fp-accent-soft px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-fp-accent-ink">
      <span>✦ {merchant.merchantName} — you filed it under</span>
      <ChipRow label="Suggested categories">
        {merchant.categoryIds.map((id) => (
          <Chip
            key={id}
            size="sm"
            active={id === selectedId}
            onClick={() => onPick(id)}
          >
            <span
              aria-hidden
              className="size-2 flex-none rounded-full"
              style={{ background: catalog.get(id).color }}
            />
            <span className="truncate">{catalog.labelOf(id)}</span>
          </Chip>
        ))}
      </ChipRow>
    </div>
  )
}
