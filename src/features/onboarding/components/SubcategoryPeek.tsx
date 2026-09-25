import { X } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import type { ResolvedCategory } from '#/features/categories/data/catalog'

type Props = {
  category: ResolvedCategory
  onClose: () => void
}

export function SubcategoryPeek({ category, onClose }: Props) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-[14px] border border-fp-border bg-fp-surface px-4 py-3.5">
      <IconChip
        id={category.icon}
        color={category.color}
        size={32}
        iconSize={17}
        className="rounded-[9px]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold">
          {category.name} comes with {category.subs.length} subcategories
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {category.subs.map((sub) => (
            <li
              key={sub.slug}
              className="rounded-full bg-fp-surface-2 px-2.5 py-1 text-[12.5px] font-semibold text-fp-text-2"
            >
              {sub.name}
            </li>
          ))}
        </ul>
        <p className="mt-[9px] text-[12.5px] text-fp-text-3">
          Included automatically. Edit them anytime in Settings.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex-none cursor-pointer p-0.5 text-fp-text-3 hover:text-fp-text"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
