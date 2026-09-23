import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Icon } from '#/components/icons/Icon'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { ResolvedCategory } from '#/features/categories/data/catalog'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'

type Props = {
  type: TxType
  selected: string
  selectedSub?: string | null
  /** Off for quick-add, which files under the parent and never opens the second step. */
  allowSubcategory?: boolean
  onSelect: (categoryId: string, subcategoryId: string | null) => void
  onClose: () => void
}

const tile = 'flex flex-col items-center gap-1 rounded-[11px] border px-1 py-2'
const option =
  'flex w-full items-center gap-[10px] rounded-[12px] border px-[11px] py-[9px] text-start'

const tint = (color: string, active: boolean) => ({
  borderColor: active ? color : 'var(--fp-border)',
  background: active ? `${color}1A` : 'var(--fp-surface-2)',
  color: active ? color : 'var(--fp-text-2)',
})

/**
 * "Choose a category", in two steps: the grid of categories, then — only for a category that
 * has children — the list inside it. A childless category selects straight from the grid, so
 * the common path stays one tap.
 */
export function CategoryPickerDialog({
  type,
  selected,
  selectedSub = null,
  allowSubcategory = true,
  onSelect,
  onClose,
}: Props) {
  const catalog = useCategoryCatalog()
  const [parent, setParent] = useState<ResolvedCategory | null>(null)

  const title = parent ? (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setParent(null)}
        aria-label="Back to categories"
        className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-fp-surface-2 text-fp-text-2 transition hover:text-fp-text"
      >
        <ChevronLeft size={17} strokeWidth={2} className="rtl:-scale-x-100" />
      </button>
      {parent.name}
    </span>
  ) : (
    'Choose a category'
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={title}
      description={
        parent
          ? `Pick a subcategory, or file it under ${parent.name} itself.`
          : 'Pick where this belongs.'
      }
      contentClassName="sm:max-w-[420px]"
    >
      {parent ? (
        <div className="flex flex-col gap-[6px]">
          <button
            type="button"
            onClick={() => onSelect(parent.slug, null)}
            className={option}
            style={tint(
              parent.color,
              selected === parent.slug && selectedSub === null,
            )}
          >
            <Icon id={parent.icon} size={19} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13.5px] font-semibold">
                {parent.name}
              </span>
              <span className="text-[11.5px] text-fp-text-3">
                Just the category
              </span>
            </span>
          </button>
          {parent.subs.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => onSelect(parent.slug, s.slug)}
              className={option}
              style={tint(
                s.color,
                selected === parent.slug && selectedSub === s.slug,
              )}
            >
              <Icon id={s.icon} size={19} />
              <span className="truncate text-[13.5px] font-semibold">
                {s.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {catalog.byType(type).map((c) => {
            const active = c.slug === selected
            return (
              <button
                key={c.slug}
                type="button"
                title={c.name}
                onClick={() =>
                  allowSubcategory && c.subs.length > 0
                    ? setParent(c)
                    : onSelect(c.slug, null)
                }
                className={tile}
                style={tint(c.color, active)}
              >
                <Icon id={c.icon} size={18} />
                <span
                  className="truncate text-[9.5px] font-semibold"
                  style={{ color: active ? c.color : 'var(--fp-text-3)' }}
                >
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </ResponsiveDialog>
  )
}
