import { Coins } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { CurrencyCode } from '#/lib/currency'
import type { CurrencyBreakdown } from '#/features/wallets/data/selectors'

type Props = {
  breakdown: CurrencyBreakdown[]
  base: CurrencyCode
}

export function CurrencyBreakdownCard({ breakdown, base }: Props) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="mb-[3px] text-[14px] font-bold">By currency</div>
      <div className="mb-[15px] text-[12px] text-fp-text-3">
        Everything combined in {base}
      </div>
      <div className="flex flex-col gap-[14px]">
        {breakdown.map((b) => (
          <div key={b.currency}>
            <div className="mb-[6px] flex items-center gap-2">
              <div
                className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
                style={{ background: b.color }}
              />
              <span className="text-[13px] font-semibold">{b.currency}</span>
              <span className="text-[11.5px] text-fp-text-3 tabular-nums">
                {b.pctStr}
              </span>
              <div className="flex-1" />
              <span className="fp-sensitive text-[13px] font-bold tabular-nums">
                {b.amountStr}
              </span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-[4px] bg-fp-surface-2">
              <div
                className="h-full rounded-[4px]"
                style={{ width: `${Math.max(2, b.pct)}%`, background: b.color }}
              />
            </div>
            {b.showBase ? (
              <div className="fp-sensitive mt-1 text-end text-[11px] text-fp-text-3 tabular-nums">
                {b.baseStr}
              </div>
            ) : null}
          </div>
        ))}
        {breakdown.length === 0 ? (
          <EmptyState
            icon={Coins}
            size="sm"
            title="No currencies yet"
            text="Add a wallet to see the currency split."
          />
        ) : null}
      </div>
    </div>
  )
}
