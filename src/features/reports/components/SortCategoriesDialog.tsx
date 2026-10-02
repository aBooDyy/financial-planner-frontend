import { IconChip } from '#/components/icons/IconChip'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { SpendClassChip } from '#/features/categories/components/SpendClassChip'
import { setCategorySpendClass } from '#/features/categories/data/mutations'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'

type Props = {
  /** The roots the period's unsorted spending is filed under. */
  rootIds: ReadonlyArray<string>
  onClose: () => void
}

/**
 * Tag the categories the split could not place. The list holds still while it is open, so a
 * category just tagged stays on screen showing its new bucket.
 */
export function SortCategoriesDialog({ rootIds, onClose }: Props) {
  const catalog = useCategoryCatalog()
  const roots = rootIds.filter((id) => catalog.has(id)).map(catalog.get)

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Sort your categories"
      description="Tag each as a need, a want or savings. Subcategories follow unless you tag them in Settings."
      contentClassName="sm:max-w-[440px]"
      footer={
        <Button
          type="button"
          onClick={onClose}
          className="w-full rounded-[12px] py-[11px] text-[14px] font-bold"
        >
          Done
        </Button>
      }
    >
      <ul className="flex flex-col overflow-hidden rounded-[14px] border border-fp-border bg-fp-surface">
        {roots.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-[10px] border-b border-fp-border px-[14px] py-[9px] last:border-b-0"
          >
            <IconChip id={c.icon} color={c.color} size={32} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              {c.name}
            </span>
            <SpendClassChip
              categoryName={c.name}
              value={c.spendClass}
              onChange={(v) => void setCategorySpendClass(c.id, v)}
            />
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}
