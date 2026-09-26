import { ChartPie } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { BreakdownView } from '#/features/transactions/data/selectors'

export function BreakdownCard({ view }: { view: BreakdownView }) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="mb-[3px] text-[14px] font-bold">Where it went</div>
      <div className="mb-[15px] text-[12px] text-fp-text-3">{view.sub}</div>
      {view.hasData ? (
        <div className="flex items-center gap-4">
          <div
            className="flex h-[92px] w-[92px] flex-none items-center justify-center rounded-full"
            style={{ background: view.gradient }}
          >
            <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-fp-surface">
              <span className="text-[9px] font-bold text-fp-text-3">SPENT</span>
              <span className="fp-sensitive text-[13px] font-extrabold tabular-nums">
                {view.centerStr}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {view.items.map((i) => (
              <div key={i.name} className="flex items-center gap-2">
                <span
                  className="h-[9px] w-[9px] flex-none rounded-[3px]"
                  style={{ background: i.color }}
                />
                <span className="min-w-0 truncate text-[12.5px] font-semibold">
                  {i.name}
                </span>
                <div className="flex-1" />
                <span className="text-[12px] tabular-nums text-fp-text-3">
                  {i.pctStr}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ChartPie}
          size="sm"
          title="No spending yet"
          text="Spending in this window is broken down here by category."
        />
      )}
    </div>
  )
}
