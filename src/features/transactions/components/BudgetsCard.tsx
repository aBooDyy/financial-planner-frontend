import { Plus, Wallet } from 'lucide-react'
import type {
  BudgetRow,
  BudgetsView,
} from '#/features/transactions/data/selectors'
import { Button } from '#/components/ui/button'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  view: BudgetsView
  onAdd: () => void
  onEdit: (id: string) => void
}

function Row({ b, onEdit }: { b: BudgetRow; onEdit: (id: string) => void }) {
  return (
    <div
      onClick={() => onEdit(b.id)}
      className="mb-[9px] cursor-pointer rounded-[14px] border border-fp-border p-[13px]"
      style={{
        background: b.over ? 'var(--fp-surface-2)' : 'var(--fp-surface)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]"
          style={{ background: `${b.color}22`, color: b.color }}
        >
          {b.categoryIcon ? (
            <CategoryIcon categoryId={b.categoryIcon} size={19} />
          ) : (
            <Wallet size={19} strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[14.5px] font-bold">{b.name}</span>
            <span className="rounded-full border border-fp-border bg-fp-surface-2 px-2 py-px text-[10.5px] font-bold uppercase tracking-[0.03em] text-fp-text-2">
              {b.periodLabel}
            </span>
          </div>
          <div className="mt-[3px] text-[12px] text-fp-text-3">
            {b.scopeSub}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-[14.5px] font-extrabold tabular-nums">
            {b.spentStr}
            <span className="text-[12px] font-semibold text-fp-text-3">
              {' '}
              / {b.limitStr}
            </span>
          </div>
          <span
            className="mt-[2px] block text-[11.5px] font-bold"
            style={{ color: b.over ? '#E5484D' : 'var(--fp-text-3)' }}
          >
            {b.remainStr}
          </span>
        </div>
      </div>
      <div className="mt-[11px] flex items-center gap-[11px]">
        <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-fp-surface-2">
          <div
            className="h-full rounded-[5px]"
            style={{ width: `${b.pct}%`, background: b.barColor }}
          />
        </div>
        <span
          className="min-w-[38px] text-right text-[12px] font-bold tabular-nums"
          style={{ color: b.barColor }}
        >
          {b.pctStr}
        </span>
      </div>
    </div>
  )
}

export function BudgetsCard({ view, onAdd, onEdit }: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Budgets</span>
          <span className="text-[12px] text-fp-text-3">
            {view.countStr} · spending caps by category, account &amp; period
          </span>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          className="gap-[5px] rounded-[11px] px-[13px] py-[9px] text-[13px] text-white [&_svg]:size-[15px]"
        >
          <Plus size={15} strokeWidth={2.2} />
          New budget
        </Button>
      </div>
      <div className="p-[10px]">
        {view.rows.map((b) => (
          <Row key={b.id} b={b} onEdit={onEdit} />
        ))}
        {view.empty ? (
          <div className="px-4 py-[34px] text-center text-[13.5px] text-fp-text-3">
            No budgets yet — set your first cap.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BudgetHealthCard({
  view,
  onAdd,
}: {
  view: BudgetsView
  onAdd: () => void
}) {
  const h = view.health
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="mb-[14px] text-[14px] font-bold">Budget health</div>
      <div className="mb-[15px] flex gap-2">
        <div className="flex-1 rounded-[12px] border border-fp-border bg-fp-surface-2 p-[11px]">
          <div className="text-[20px] font-extrabold tabular-nums text-fp-accent">
            {h.onTrack}
          </div>
          <div className="mt-[2px] text-[11.5px] text-fp-text-3">on track</div>
        </div>
        <div className="flex-1 rounded-[12px] border border-fp-border bg-fp-surface-2 p-[11px]">
          <div
            className="text-[20px] font-extrabold tabular-nums"
            style={{ color: '#E5484D' }}
          >
            {h.over}
          </div>
          <div className="mt-[2px] text-[11.5px] text-fp-text-3">
            over limit
          </div>
        </div>
      </div>
      <div className="mb-[7px] flex justify-between text-[12.5px]">
        <span className="font-semibold text-fp-text-2">Spent this month</span>
        <span className="font-bold tabular-nums">
          {h.spentStr} / {h.totalStr}
        </span>
      </div>
      <div className="h-[10px] overflow-hidden rounded-[6px] bg-fp-surface-2">
        <div
          className="h-full rounded-[6px]"
          style={{ width: `${h.pct}%`, background: h.barColor }}
        />
      </div>
      <div className="mt-[9px] text-[12px] text-fp-text-3">{h.leftStr}</div>
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="mt-4 w-full rounded-[11px] p-[11px] text-[13.5px] font-bold hover:border-fp-accent"
      >
        + Add a budget
      </Button>
    </div>
  )
}
