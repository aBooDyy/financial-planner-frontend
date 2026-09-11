import { CalendarDays, Trash2 } from 'lucide-react'
import type { IncomeRow as IncomeRowData } from '#/features/goals/data/selectors'
import { Button } from '#/components/ui/button'

type Props = {
  row: IncomeRowData
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function IncomeRow({ row, onEdit, onDelete }: Props) {
  return (
    <div
      onClick={() => onEdit(row.id)}
      className="flex cursor-pointer items-center gap-[11px] border-b border-fp-border px-[14px] py-3 last:border-b-0 hover:bg-fp-surface-2"
    >
      <div
        className="h-[11px] w-[11px] shrink-0 rounded-[4px] ring-1 ring-black/10"
        style={{ background: row.color }}
      />
      <div className="flex min-w-0 flex-col gap-px">
        <span className="text-[14px] font-semibold">{row.label}</span>
        <span className="text-[12px] text-fp-text-3">{row.subStr}</span>
        <span className="flex items-center gap-[5px] text-[11.5px] text-fp-text-3">
          <CalendarDays size={12} strokeWidth={1.8} />
          {row.payStr}
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col items-end">
        <span className="text-[14px] font-bold tabular-nums">
          {row.monthlyStr}
          <span className="text-[11.5px] font-semibold text-fp-text-3">
            /mo
          </span>
        </span>
        {row.showOriginal ? (
          <span className="text-[11.5px] text-fp-text-3 tabular-nums">
            {row.originalStr}
          </span>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(row.id)
        }}
        className="h-7 w-7 rounded-[8px] text-fp-text-3 hover:bg-fp-bg hover:text-fp-danger"
      >
        <Trash2 size={14} strokeWidth={1.8} />
      </Button>
    </div>
  )
}
