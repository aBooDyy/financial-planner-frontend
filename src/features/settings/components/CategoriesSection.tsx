import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '#/features/settings/data/mutations'
import { useCategories } from '#/features/settings/hooks/useCategories'
import { SectionHeader } from './SectionHeader'
import { CAT_COLORS, CategoryRow } from './CategoryRow'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

export function CategoriesSection() {
  const { categories } = useCategories()

  const onAdd = () =>
    void createCategory({
      name: 'New category',
      type: 'spend',
      color: CAT_COLORS[categories.length % CAT_COLORS.length],
    })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Categories"
        subtitle="The set used to tag every transaction."
        action={
          <Button
            type="button"
            onClick={onAdd}
            className="gap-1.5 rounded-[11px] bg-fp-accent px-[13px] py-[9px] text-[13px] font-bold text-white shadow-[0_4px_12px_-4px_var(--fp-accent)] hover:brightness-105"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add category
          </Button>
        }
      />
      <div className={CARD}>
        {categories.length === 0 ? (
          <div className="px-[18px] py-6 text-[13px] text-fp-text-3">
            No categories yet.
          </div>
        ) : (
          categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              category={c}
              onSave={(patch) => void updateCategory(c.id, patch)}
              onDelete={() => void deleteCategory(c.id)}
              last={i === categories.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}
