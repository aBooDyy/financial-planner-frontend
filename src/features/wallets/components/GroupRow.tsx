import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/wallets/data/selectors'

type Props = {
  row: BalanceRow
  /** The subtotal is still loading. */
  loading: boolean
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddInside: (id: string) => void
}

// the row runs out of width at 320px; below `sm` the chip and this cluster both give some back.
const ACTION =
  'size-6 sm:size-7 rounded-lg text-fp-text-3 hover:bg-fp-bg max-sm:[&_svg]:size-[13px]'

const stop = (fn: (id: string) => void, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  fn(id)
}

export function GroupRow({
  row,
  loading,
  onToggle,
  onEdit,
  onDelete,
  onAddInside,
}: Props) {
  return (
    <div
      onClick={() => onToggle(row.id)}
      className="flex cursor-pointer items-center gap-[6px] sm:gap-[9px] border-b border-fp-border bg-fp-surface-2 px-[10px] py-[11px] sm:px-[14px] hover:brightness-[0.985]"
    >
      <div style={{ marginInlineStart: row.depth * 20 }} className="shrink-0" />
      <span
        className="inline-flex shrink-0 text-fp-text-3 transition-transform"
        style={{ transform: row.collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
      >
        <ChevronRight size={15} strokeWidth={2.2} />
      </span>
      <IconChip
        id={row.icon}
        color={row.color}
        className="max-sm:size-7 max-sm:[&>svg]:size-[15px]"
      />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">
        {row.name}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-fp-text-3 max-sm:hidden">
        {row.childCountStr}
      </span>
      <span className="fp-sensitive text-[13px] font-bold tabular-nums whitespace-nowrap sm:text-[14px]">
        <ValueOrSkeleton
          value={loading ? null : row.subtotalStr}
          className="h-3.5 w-20"
        />
      </span>
      <div className="ms-[2px] flex gap-px">
        <Button
          variant="ghost"
          size="icon"
          title="Add wallet inside"
          className={`${ACTION} hover:text-fp-accent-ink`}
          onClick={stop(onAddInside, row.id)}
        >
          <Plus size={15} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Edit group"
          className={`${ACTION} hover:text-fp-text`}
          onClick={stop(onEdit, row.id)}
        >
          <Pencil size={14} strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          className={`${ACTION} hover:text-fp-danger`}
          onClick={stop(onDelete, row.id)}
        >
          <Trash2 size={14} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  )
}
