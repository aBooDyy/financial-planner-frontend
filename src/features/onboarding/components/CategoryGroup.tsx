import type { ResolvedCategory } from '#/features/categories/data/catalog'
import { isRequired } from '../data/packs'
import { CategoryChip } from './CategoryChip'
import { SubcategoryPeek } from './SubcategoryPeek'

type Props = {
  label: string
  categories: ResolvedCategory[]
  selected: ReadonlySet<string>
  peek: string | null
  onToggle: (slug: string) => void
  onPeek: (slug: string | null) => void
}

export function CategoryGroup({
  label,
  categories,
  selected,
  peek,
  onToggle,
  onPeek,
}: Props) {
  const count = categories.filter((c) => selected.has(c.slug)).length
  const peeked = categories.find((c) => c.slug === peek && selected.has(c.slug))

  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-[12px] font-bold tracking-[0.05em] text-fp-text-3 uppercase">
          {label}
        </h2>
        <span className="text-[12px] font-semibold text-fp-text-3">
          {count} of {categories.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <CategoryChip
            key={category.slug}
            category={category}
            on={selected.has(category.slug)}
            required={isRequired(category.slug)}
            peekOpen={peek === category.slug}
            onToggle={() => onToggle(category.slug)}
            onPeek={() => onPeek(peek === category.slug ? null : category.slug)}
          />
        ))}
      </div>
      {peeked && (
        <SubcategoryPeek category={peeked} onClose={() => onPeek(null)} />
      )}
    </section>
  )
}
