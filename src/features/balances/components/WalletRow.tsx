import { ChevronRight, Pencil, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/balances/data/selectors'

type Props = {
  row: BalanceRow
  expanded: boolean
  onToggleReservations: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const ACTION = 'h-7 w-7 rounded-lg text-fp-text-3 hover:bg-fp-bg'

const stop = (fn: (id: string) => void, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  fn(id)
}

export function WalletRow({
  row,
  expanded,
  onToggleReservations,
  onEdit,
  onDelete,
}: Props) {
  return (
    <>
      <div
        onClick={() => onEdit(row.id)}
        className="flex cursor-pointer items-center gap-[10px] border-b border-fp-border px-[14px] py-[11px] hover:bg-fp-surface-2"
      >
        <div
          style={{ marginInlineStart: row.depth * 20 }}
          className="shrink-0"
        />
        <div
          className="h-[11px] w-[11px] shrink-0 rounded-[4px] ring-1 ring-black/10"
          style={{ background: row.color }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-semibold whitespace-nowrap">
            {row.name}
          </span>
          {row.note ? (
            <span className="max-w-[240px] truncate text-[12px] text-fp-text-3">
              {row.note}
            </span>
          ) : null}
          {row.hasReserved ? (
            <button
              type="button"
              onClick={stop(onToggleReservations, row.id)}
              className="mt-[3px] inline-flex w-fit items-center gap-1 text-[11.5px] font-medium text-fp-text-3 hover:text-fp-text-2"
            >
              <ChevronRight
                size={12}
                strokeWidth={2.2}
                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
              <span className="tabular-nums">
                <span
                  className={
                    row.overReserved ? 'font-semibold text-fp-danger' : ''
                  }
                >
                  {row.availableStr}{' '}
                  {row.overReserved ? 'over-reserved' : 'available'}
                </span>{' '}
                · {row.reservedStr} reserved
              </span>
            </button>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="flex flex-col items-end">
          <span className="text-[14px] font-bold tabular-nums whitespace-nowrap">
            {row.amountStr}
          </span>
          {row.isForeign ? (
            <span className="text-[11.5px] text-fp-text-3 tabular-nums">
              {row.baseStr}
            </span>
          ) : null}
        </div>
        <div className="ms-[2px] flex gap-px">
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
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

      {expanded && row.hasReserved ? (
        <div className="border-b border-fp-border bg-fp-surface-2">
          {row.reservations.map((r) => (
            <div
              key={r.goalId}
              className="flex items-center gap-[10px] px-[14px] py-[7px]"
            >
              <div
                style={{ marginInlineStart: row.depth * 20 + 21 }}
                className="shrink-0"
              />
              <div
                className="h-[9px] w-[9px] shrink-0 rounded-[3px] ring-1 ring-black/10"
                style={{ background: r.color }}
              />
              <span className="truncate text-[12.5px] text-fp-text-2">
                {r.goalName}
              </span>
              <div className="flex-1" />
              <span className="text-[12.5px] font-semibold tabular-nums text-fp-text-2">
                {r.amountStr}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}
