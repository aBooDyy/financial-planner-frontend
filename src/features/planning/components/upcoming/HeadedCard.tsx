import { RailCardHeader } from '#/components/RailCardHeader'
import type { CurrencyCode } from '#/lib/currency'
import { money, signedMoney } from '#/features/planning/view/format'
import type { PaycheckBar } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'

/**
 * Where it's headed: the next paycheck's share for bills, saving up for bills and goals, and
 * what is left for spending — the same split as Overview's Each paycheck.
 */
export function HeadedCard({
  bar,
  base,
}: {
  bar: PaycheckBar
  base: CurrencyCode
}) {
  const parts = bar.legend.filter((s) => s.key !== 'left')
  const left = bar.legend.find((s) => s.key === 'left')
  const scale = Math.max(bar.income ?? 0, ...parts.map((p) => p.amount), 1)
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader title="Where it’s headed" sub="Next paycheck" />
      <ul className="flex flex-col gap-3">
        {parts.map((p) => (
          <li key={p.key} className="flex flex-col gap-[6px]">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-semibold text-fp-text-2">{p.label}</span>
              <span className="fp-sensitive font-bold tabular-nums">
                {money(p.amount, base)}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-fp-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (p.amount / scale) * 100)}%`,
                  background: p.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {left ? (
        <div className="mt-3 flex items-center justify-between border-t border-fp-border pt-3 text-[13px]">
          <span className="font-bold">Left for spending</span>
          <span
            className={cn(
              'fp-sensitive font-extrabold tabular-nums',
              left.amount < 0 ? 'text-fp-danger' : 'text-fp-accent-ink',
            )}
          >
            {signedMoney(left.amount, base)}
          </span>
        </div>
      ) : (
        <p className="mt-3 border-t border-fp-border pt-3 text-[12.5px] text-fp-text-3">
          Add your income to see what is left for spending.
        </p>
      )}
    </div>
  )
}
