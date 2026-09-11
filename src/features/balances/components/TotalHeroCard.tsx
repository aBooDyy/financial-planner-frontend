import type { CurrencyCode } from '#/lib/currency'
import type { BalancesView } from '#/features/balances/data/selectors'

type Props = {
  view: BalancesView
  base: CurrencyCode
}

export function TotalHeroCard({ view, base }: Props) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-5 shadow-fp md:p-7">
      <div className="mb-[10px] flex items-center gap-2">
        <span className="text-[12px] font-bold tracking-[0.04em] text-fp-text-2 uppercase">
          Total liquid cash
        </span>
        <span className="text-[11.5px] text-fp-text-3">· Updated Jun 2026</span>
      </div>

      <div className="flex flex-wrap items-end gap-[10px]">
        <span className="text-[38px] leading-[1.05] font-extrabold tracking-[-0.02em] tabular-nums whitespace-nowrap">
          {view.grandTotalStr}
        </span>
        <span className="mb-[5px] rounded-full border border-fp-border px-[9px] py-1 text-[12px] font-bold text-fp-text-3">
          {base}
        </span>
      </div>

      <div className="mt-[9px] text-[13px] text-fp-text-2">
        {view.walletCountStr} · {view.groupCountStr} · {view.currencyCountStr}
      </div>

      {view.hasReserved ? (
        <div className="mt-[10px] flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          <span className="font-semibold text-fp-text-2 tabular-nums">
            {view.availableTotalStr}{' '}
            <span className="font-medium text-fp-text-3">available</span>
          </span>
          <span className="font-semibold text-fp-text-2 tabular-nums">
            {view.reservedTotalStr}{' '}
            <span className="font-medium text-fp-text-3">
              reserved for goals
            </span>
          </span>
        </div>
      ) : null}

      <div className="mt-[18px] flex h-3 gap-[2px] overflow-hidden rounded-[7px] bg-fp-surface-2">
        {view.groupBars.map((bar) => (
          <div
            key={bar.id}
            style={{ width: `${Math.max(1, bar.pct)}%`, background: bar.color }}
          />
        ))}
      </div>

      <div className="mt-[13px] flex flex-wrap gap-x-4 gap-y-[6px]">
        {view.groupBars.map((bar) => (
          <div key={bar.id} className="flex items-center gap-[7px]">
            <div
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: bar.color }}
            />
            <span className="text-[12.5px] font-semibold">{bar.label}</span>
            <span className="text-[12px] text-fp-text-3 tabular-nums">
              {bar.valueStr}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
