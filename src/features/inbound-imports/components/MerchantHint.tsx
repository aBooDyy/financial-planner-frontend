import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { ImportMerchant } from '#/features/inbound-imports/api/types'

type Props = {
  merchant: ImportMerchant
  catalog: CategoryCatalog
}

/** What the user filed this merchant under before, so a repeat is one glance to confirm. */
export function MerchantHint({ merchant, catalog }: Props) {
  if (merchant.timesConfirmed === 0) return null
  const category =
    merchant.learnedCategoryId && catalog.has(merchant.learnedCategoryId)
      ? catalog.labelOf(merchant.learnedCategoryId)
      : 'a category'
  return (
    <div className="rounded-[12px] bg-fp-accent-soft px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-fp-accent-ink">
      ✦ {merchant.displayName} — you filed it under {category}{' '}
      {merchant.timesConfirmed === 1
        ? 'last time'
        : `${merchant.timesConfirmed} times`}
    </div>
  )
}
