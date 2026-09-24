import { Link } from '@tanstack/react-router'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { PlannedListView } from '#/features/planned/data/views'
import { NEXT_DAYS } from '#/features/planned/data/views'

type Props = { view: PlannedListView; base: CurrencyCode }

function Line({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]">
      <span className="text-[13px] text-fp-text-2">{label}</span>
      <span
        className={`text-[14px] font-bold tabular-nums ${accent ? 'text-fp-accent' : 'text-fp-text'}`}
      >
        {value}
      </span>
    </div>
  )
}

/** The Planned tab's rail: what the next two weeks bring in and take out, before confirming. */
export function PlannedSummaryCard({ view, base }: Props) {
  const net = view.nextIn - view.nextOut
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-4 shadow-fp">
      <div className="mb-2 flex flex-col">
        <span className="text-[15px] font-bold">Next {NEXT_DAYS} days</span>
        <span className="text-[12px] text-fp-text-3">
          Planned, not yet confirmed
        </span>
      </div>
      <Line
        label="Coming in"
        value={`+${formatMoney(view.nextIn, base)}`}
        accent
      />
      <Line label="Going out" value={`−${formatMoney(view.nextOut, base)}`} />
      <div className="my-[6px] border-t border-fp-border" />
      <Line
        label="Net"
        value={`${net < 0 ? '−' : '+'}${formatMoney(Math.abs(net), base)}`}
      />
      {view.dueCount > 0 ? (
        <p className="mt-2 text-[12px] text-fp-warn">
          {view.dueCount} past{' '}
          {view.dueCount === 1 ? 'item needs' : 'items need'} confirming too.
        </p>
      ) : null}
      <Link
        to="/goals"
        className="mt-3 inline-block text-[12.5px] font-bold text-fp-accent-ink underline-offset-4 hover:underline"
      >
        Plans live on Goals
      </Link>
    </div>
  )
}
