import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { CategoryEditor } from '#/features/categories/components/CategoryEditor'
import { CategoryTree } from '#/features/categories/components/CategoryTree'
import { DeleteCategoryDialog } from '#/features/categories/components/DeleteCategoryDialog'
import { deleteCategory } from '#/features/categories/data/mutations'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useCategoryEditor } from '#/features/categories/hooks/useCategoryEditor'
import { useCategoryTree } from '#/features/categories/hooks/useCategoryTree'
import type { DeleteTarget } from '#/features/categories/hooks/useDeleteChoice'
import { SectionHeader } from './SectionHeader'
import { Segmented } from './Segmented'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

export function CategoriesSection() {
  const { loading, type, setType, categories } = useCategoryTree()
  const catalog = useCategoryCatalog()
  const editor = useCategoryEditor(type, categories.length)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)

  const askDelete = (id: string) => {
    for (const c of categories) {
      if (c.id === id) {
        setDeleting({
          id,
          name: c.name,
          type: c.type,
          parentId: null,
          subCount: c.subs.length,
          txCount: c.txCount,
          recurringCount: c.recurringCount,
        })
        return
      }
      const child = c.subs.find((s) => s.id === id)
      if (child) {
        setDeleting({
          id,
          name: child.name,
          type: c.type,
          parentId: c.id,
          subCount: 0,
          txCount: child.txCount,
          recurringCount: child.recurringCount,
        })
        return
      }
    }
  }

  const confirmDelete = (moveToId: string | null) => {
    if (deleting) void deleteCategory(deleting.id, moveToId)
    setDeleting(null)
    addRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Categories"
        subtitle="The set used to tag every transaction. Add subcategories for the detail you care about."
        action={
          <Button
            ref={addRef}
            type="button"
            onClick={() => editor.openCreate(null)}
            className="gap-1.5 rounded-[11px] bg-fp-accent px-[13px] py-[9px] text-[13px] font-bold text-white shadow-[0_4px_12px_-4px_var(--fp-accent)] hover:brightness-105"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add category
          </Button>
        }
      />

      <div className="flex">
        <Segmented
          value={type}
          options={[
            { value: 'spend', label: 'Spending' },
            { value: 'income', label: 'Income' },
          ]}
          onChange={setType}
        />
      </div>

      <div className={CARD}>
        {loading || categories.length === 0 ? (
          <div className="px-[18px] py-6 text-[13px] text-fp-text-3">
            {loading ? 'Loading…' : 'No categories yet.'}
          </div>
        ) : (
          <CategoryTree
            categories={categories}
            onEdit={editor.openEdit}
            onDelete={askDelete}
            onAddSub={(parentId) => editor.openCreate(parentId)}
          />
        )}
      </div>

      <CategoryEditor editor={editor} catalog={catalog} />
      <DeleteCategoryDialog
        target={deleting}
        catalog={catalog}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
