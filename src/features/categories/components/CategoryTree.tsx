import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { SpendClass } from '#/features/categories/api/types'
import { isRequiredCategory } from '#/features/categories/data/required'
import { SpendClassChip } from './SpendClassChip'
import { CategoryTreeRow } from './CategoryTreeRow'
import type {
  CategoryTreeNode,
  CategoryTreeSub,
} from '#/features/categories/hooks/useCategoryTree'

const CHILD_INDENT = 22

type Props = {
  categories: CategoryTreeNode[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddSub: (parentId: string) => void
  /** Set for spending categories: tags one as needs, wants or savings. */
  onSpendClass?: (id: string, value: SpendClass | null) => void
}

const subsLabel = (n: number) =>
  `· ${n} ${n === 1 ? 'subcategory' : 'subcategories'}`

/** The two-level Settings list. Expansion is component state: a settings list is not a page. */
export function CategoryTree({
  categories,
  onEdit,
  onDelete,
  onAddSub,
  onSpendClass,
}: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <>
      {categories.map((c) => {
        const open = expanded.has(c.id)
        return (
          <div key={c.id}>
            <CategoryTreeRow
              name={c.name}
              color={c.color}
              icon={c.icon}
              txCount={c.txCount}
              meta={
                !open && c.subs.length > 0
                  ? subsLabel(c.subs.length)
                  : undefined
              }
              disclosure={
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-expanded={open}
                  aria-label={`Show subcategories of ${c.name}`}
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text"
                >
                  <ChevronRight
                    size={14}
                    strokeWidth={2.2}
                    className={`transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                </button>
              }
              tag={
                onSpendClass ? (
                  <SpendClassChip
                    categoryName={c.name}
                    value={c.spendClass}
                    onChange={(v) => onSpendClass(c.id, v)}
                  />
                ) : undefined
              }
              onEdit={() => onEdit(c.id)}
              onDelete={
                isRequiredCategory(c) ? undefined : () => onDelete(c.id)
              }
            />
            {open ? (
              <>
                {c.subs.map((s: CategoryTreeSub) => (
                  <CategoryTreeRow
                    key={s.id}
                    name={s.name}
                    color={s.color}
                    icon={s.icon}
                    txCount={s.txCount}
                    indent={CHILD_INDENT}
                    tag={
                      onSpendClass ? (
                        <SpendClassChip
                          categoryName={s.name}
                          value={s.spendClass}
                          inherits={{ name: c.name, value: c.spendClass }}
                          onChange={(v) => onSpendClass(s.id, v)}
                        />
                      ) : undefined
                    }
                    onEdit={() => onEdit(s.id)}
                    onDelete={() => onDelete(s.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onAddSub(c.id)}
                  className="flex w-full items-center gap-[6px] border-b border-fp-border py-[9px] pe-[18px] text-[13px] font-semibold text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text"
                  style={{ paddingInlineStart: 18 + CHILD_INDENT + 22 }}
                >
                  <Plus size={14} strokeWidth={2.2} />
                  Add subcategory
                </button>
              </>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
