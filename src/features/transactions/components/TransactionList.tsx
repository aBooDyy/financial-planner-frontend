import { Plus, Target } from 'lucide-react'
import type {
  ActivityListView,
  TxRow,
} from '#/features/transactions/data/selectors'
import { Button } from '#/components/ui/button'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  view: ActivityListView
  onAdd: () => void
  onRowClick: (id: string) => void
}

function Row({ row, onClick }: { row: TxRow; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b border-fp-border px-4 py-[11px] hover:bg-fp-surface-2"
    >
      <div
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]"
        style={{ background: `${row.color}22`, color: row.color }}
      >
        <CategoryIcon categoryId={row.categoryId} size={19} />
      </div>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[14px] font-semibold">{row.name}</span>
        <span className="flex items-center gap-[6px] text-[12px] text-fp-text-3">
          {row.subName ?? row.catName}
          <span className="h-[3px] w-[3px] rounded-full bg-fp-border-strong" />
          <span
            className="h-[7px] w-[7px] rounded-[2px]"
            style={{ background: row.walletColor }}
          />
          {row.walletName}
          {row.isContribution ? (
            <span className="ms-1 inline-flex items-center gap-[3px] rounded-full bg-fp-accent-soft px-[6px] py-px text-[10px] font-bold text-fp-accent-ink">
              <Target size={10} strokeWidth={2.2} />
              Goal
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex-1" />
      <span
        className="whitespace-nowrap text-[14.5px] font-bold tabular-nums"
        style={{ color: row.isIncome ? 'var(--fp-accent)' : 'var(--fp-text)' }}
      >
        {row.amountStr}
      </span>
    </div>
  )
}

export function TransactionList({ view, onAdd, onRowClick }: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Transactions</span>
          <span className="text-[12px] text-fp-text-3">{view.countStr}</span>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          className="gap-[5px] rounded-[11px] px-[13px] py-[9px] text-[13px] text-white [&_svg]:size-[15px]"
        >
          <Plus size={15} strokeWidth={2.2} />
          Add
        </Button>
      </div>
      <div>
        {view.groups.map((g) => (
          <div key={g.dateLabel}>
            <div className="flex items-baseline justify-between gap-2 bg-fp-surface-2 px-4 pb-[6px] pt-[11px]">
              <span className="text-[12px] font-bold text-fp-text-2">
                {g.dateLabel}
              </span>
              <span className="text-[12px] tabular-nums text-fp-text-3">
                {g.totalStr}
              </span>
            </div>
            {g.rows.map((r) => (
              <Row key={r.id} row={r} onClick={() => onRowClick(r.id)} />
            ))}
          </div>
        ))}
        {view.empty ? (
          <div className="px-4 py-10 text-center text-[13.5px] text-fp-text-3">
            No transactions in this period — add one with the quick-add panel.
          </div>
        ) : null}
      </div>
    </div>
  )
}
