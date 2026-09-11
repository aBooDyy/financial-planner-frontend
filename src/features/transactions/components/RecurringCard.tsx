import { Repeat } from 'lucide-react'
import type {
  RecurringRow,
  RecurringView,
} from '#/features/transactions/data/selectors'
import { Button } from '#/components/ui/button'
import { CategoryIcon } from './CategoryIcon'

type Props = {
  view: RecurringView
  onAdd: () => void
  onEdit: (id: string) => void
}

function Row({ r, onEdit }: { r: RecurringRow; onEdit: (id: string) => void }) {
  return (
    <div
      onClick={() => onEdit(r.id)}
      className="mb-[9px] cursor-pointer rounded-[14px] border border-fp-border bg-fp-surface p-[13px] hover:border-fp-border-strong"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]"
          style={{ background: `${r.color}22`, color: r.color }}
        >
          <CategoryIcon categoryId={r.categoryIcon} size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[14.5px] font-bold">{r.name}</span>
            <span className="rounded-full border border-fp-border bg-fp-surface-2 px-2 py-px text-[10.5px] font-bold uppercase tracking-[0.03em] text-fp-text-2">
              {r.cadenceLabel}
            </span>
            {r.autopost ? (
              <span className="rounded-full bg-fp-accent-soft px-[7px] py-px text-[10px] font-bold text-fp-accent-ink">
                AUTO
              </span>
            ) : null}
          </div>
          <div className="mt-[3px] flex items-center gap-[6px] text-[12px] text-fp-text-3">
            {r.catName}
            <span className="h-[3px] w-[3px] rounded-full bg-fp-border-strong" />
            <span
              className="h-[7px] w-[7px] rounded-[2px]"
              style={{ background: r.walletColor }}
            />
            {r.walletName}
          </div>
        </div>
        <div className="flex-none text-right">
          <div
            className="text-[14.5px] font-extrabold tabular-nums"
            style={{
              color: r.isIncome ? 'var(--fp-accent)' : 'var(--fp-text)',
            }}
          >
            {r.amountStr}
          </div>
          <div className="mt-[2px] text-[11.5px] tabular-nums text-fp-text-3">
            next {r.nextStr}
          </div>
        </div>
      </div>
    </div>
  )
}

export function RecurringCard({ view, onAdd, onEdit }: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Recurring</span>
          <span className="text-[12px] text-fp-text-3">
            {view.countStr} · bills &amp; regular income on a schedule
          </span>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          className="gap-[5px] rounded-[11px] px-[13px] py-[9px] text-[13px] text-white [&_svg]:size-[15px]"
        >
          <Repeat size={15} strokeWidth={2} />
          New recurring
        </Button>
      </div>
      <div className="p-[10px]">
        {view.rows.map((r) => (
          <Row key={r.id} r={r} onEdit={onEdit} />
        ))}
        {view.empty ? (
          <div className="px-4 py-[34px] text-center text-[13.5px] text-fp-text-3">
            No recurring items yet.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function UpcomingCard({
  view,
  onAdd,
}: {
  view: RecurringView
  onAdd: () => void
}) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="mb-[3px] text-[14px] font-bold">Upcoming this month</div>
      <div className="mb-[15px] text-[12px] text-fp-text-3">
        {view.upcomingEmpty ? '' : 'Bills & income still scheduled this month'}
      </div>
      <div className="relative ps-[6px]">
        {view.upcoming.map((u, i) => {
          const last = i === view.upcoming.length - 1
          return (
            <div key={i} className="relative flex gap-[13px] pb-[15px]">
              {!last ? (
                <div className="absolute bottom-[-6px] left-[5px] top-[10px] w-[1.5px] bg-fp-border" />
              ) : null}
              <div
                className="absolute left-0 top-[3px] z-[1] h-[11px] w-[11px] rounded-full"
                style={{
                  background: u.color,
                  boxShadow: '0 0 0 3px var(--fp-surface)',
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-bold tabular-nums">
                    {u.dateStr}
                  </span>
                  <span className="text-[11.5px] text-fp-text-3">
                    {u.relStr}
                  </span>
                </div>
                <div className="mt-px flex items-center gap-2">
                  <span className="text-[13px] text-fp-text">{u.name}</span>
                  <div className="flex-1" />
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{
                      color: u.isIncome ? 'var(--fp-accent)' : 'var(--fp-text)',
                    }}
                  >
                    {u.amtStr}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {view.upcomingEmpty ? (
        <div className="py-[6px] text-[12.5px] text-fp-text-3">
          Nothing else due this month.
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="mt-2 w-full rounded-[11px] p-[11px] text-[13.5px] font-bold hover:border-fp-accent"
      >
        + Add recurring
      </Button>
    </div>
  )
}
