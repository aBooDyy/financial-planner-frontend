import { categoriesByType } from '#/features/transactions/categories'
import type { TxType } from '#/features/transactions/api/types'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  type: TxType
  selected: string
  onSelect: (categoryId: string) => void
  onClose: () => void
}

/** The "Choose a category" grid dialog (replaces a scrolling chip row). */
export function CategoryPickerDialog({
  type,
  selected,
  onSelect,
  onClose,
}: Props) {
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="Choose a category"
      contentClassName="sm:max-w-[420px]"
    >
      <div className="grid grid-cols-4 gap-2">
        {categoriesByType(type).map((c) => {
          const active = c.id === selected
          return (
            <button
              key={c.id}
              type="button"
              title={c.name}
              onClick={() => onSelect(c.id)}
              className="flex flex-col items-center gap-1 rounded-[11px] border px-1 py-2"
              style={{
                borderColor: active ? c.color : 'var(--fp-border)',
                background: active ? `${c.color}1A` : 'var(--fp-surface-2)',
                color: active ? c.color : 'var(--fp-text-2)',
              }}
            >
              <CategoryIcon categoryId={c.id} size={18} />
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
    </ResponsiveDialog>
  )
}
