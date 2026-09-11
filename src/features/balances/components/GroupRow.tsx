import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/balances/data/selectors'

type Props = {
  row: BalanceRow
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddInside: (id: string) => void
}

const ACTION = 'h-7 w-7 rounded-lg text-fp-text-3 hover:bg-fp-bg'

const stop = (fn: (id: string) => void, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  fn(id)
}

export function GroupRow({
  row,
  onToggle,
  onEdit,
  onDelete,
  onAddInside,
}: Props) {
  return (
    <div
      onClick={() => onToggle(row.id)}
      className="flex cursor-pointer items-center gap-[9px] border-b border-fp-border bg-fp-surface-2 px-[14px] py-[11px] hover:brightness-[0.985]"
    >
      <div style={{ marginInlineStart: row.depth * 20 }} className="shrink-0" />
      <span
        className="inline-flex shrink-0 text-fp-text-3 transition-transform"
        style={{ transform: row.collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
      >
        <ChevronRight size={15} strokeWidth={2.2} />
      </span>
      <div
        className="h-[11px] w-[11px] shrink-0 rounded-[4px] ring-1 ring-black/10"
        style={{ background: row.color }}
      />
      <span className="text-[14.5px] font-bold whitespace-nowrap">
        {row.name}
      </span>
      <span className="text-[12px] font-semibold text-fp-text-3">
        {row.childCountStr}
      </span>
      <div className="flex-1" />
      <span className="text-[14px] font-bold tabular-nums whitespace-nowrap">
        {row.subtotalStr}
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
