import type { ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { IconChip } from '#/components/icons/IconChip'
import type { IconId } from '#/lib/icons/catalog.gen'

const ICON_BTN =
  'h-[30px] w-[30px] rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2'

type Props = {
  name: string
  color: string
  icon: IconId
  txCount: number
  /** Trailing detail after the count, e.g. "· 3 subcategories". */
  meta?: string
  /** Logical start indent in px — children sit inside their parent in both directions. */
  indent?: number
  /** The disclosure control, rendered before the chip on a parent row. */
  disclosure?: ReactNode
  onEdit: () => void
  /** Absent for a category that can't be deleted. */
  onDelete?: () => void
}

/** One row of the Settings category list — a parent or a child, same anatomy. */
export function CategoryTreeRow({
  name,
  color,
  icon,
  txCount,
  meta,
  indent = 0,
  disclosure,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-[10px] border-b border-fp-border px-[18px] py-[9px] last:border-b-0 hover:bg-fp-surface-2">
      <div style={{ marginInlineStart: indent }} className="shrink-0" />
      {disclosure ?? <div className="w-[22px] shrink-0" />}
      <IconChip id={icon} color={color} size={34} />
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-[9px] text-start"
      >
        <span className="truncate text-[14.5px] font-semibold">{name}</span>
        <span className="shrink-0 rounded-full border border-fp-border bg-fp-surface-2 px-[9px] py-0.5 text-[12px] text-fp-text-3">
          {txCount} tx
        </span>
        {meta ? (
          <span className="hidden truncate text-[12px] text-fp-text-3 sm:inline">
            {meta}
          </span>
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onEdit}
        title="Edit"
        className={`${ICON_BTN} hover:text-fp-text`}
      >
        <Pencil size={15} strokeWidth={1.8} />
      </Button>
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Delete"
          className={`${ICON_BTN} hover:text-fp-danger`}
        >
          <Trash2 size={15} strokeWidth={1.8} />
        </Button>
      ) : (
        <div aria-hidden className="w-[30px] shrink-0" />
      )}
    </div>
  )
}
