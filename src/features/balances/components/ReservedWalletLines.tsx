import type { BalanceRow } from '#/features/balances/data/selectors'

/**
 * The name and figures of a wallet holding goal money. Each line pairs its own two halves, so
 * the "in bank" figure gets the width the "available" label leaves, not what the headline
 * amount leaves. A line that still runs out of room wraps; only the name ever truncates.
 */
export function ReservedWalletLines({ row }: { row: BalanceRow }) {
  const danger = row.overReserved
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold whitespace-nowrap">
          {row.name}
        </span>
        <span
          className={`shrink-0 text-[14px] font-bold tabular-nums whitespace-nowrap ${
            danger ? 'text-fp-danger' : ''
          }`}
        >
          {row.availableStr}
        </span>
      </div>
      <div className="mt-[2px] flex flex-wrap items-baseline gap-x-[6px] text-[11.5px] text-fp-text-3 tabular-nums">
        <span className="whitespace-nowrap">{row.amountStr} in bank</span>
        {row.isForeign ? (
          <span className="whitespace-nowrap">· {row.baseStr}</span>
        ) : null}
        <span
          className={`ms-auto whitespace-nowrap ${
            danger ? 'font-semibold text-fp-danger' : ''
          }`}
        >
          {danger ? 'over-reserved' : 'available'}
        </span>
      </div>
      {row.note ? (
        <span className="max-w-[240px] truncate text-[12px] text-fp-text-3">
          {row.note}
        </span>
      ) : null}
    </div>
  )
}
