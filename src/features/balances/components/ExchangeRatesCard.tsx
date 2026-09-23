import type { CurrencyCode } from '#/lib/currency'

type Props = {
  rates: Partial<Record<string, number>>
  base: CurrencyCode
  /** The currencies the user holds — see `heldCurrencies`. */
  currencies: CurrencyCode[]
}

export function ExchangeRatesCard({ rates, base, currencies }: Props) {
  const baseRate = rates[base] ?? 1
  const lines = currencies
    .filter((c) => c !== base)
    .map((c) => {
      const value = ((rates[c] ?? 0) / baseRate).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `1 ${c} = ${value} ${base}`
    })

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[16px_18px] shadow-fp">
      <div className="mb-[10px] text-[13px] font-bold">
        Exchange rates{' '}
        <span className="text-[11px] font-medium text-fp-text-3">
          · tap to edit later
        </span>
      </div>
      <div className="flex flex-col gap-[7px]">
        {lines.map((line) => (
          <span
            key={line}
            className="text-[12.5px] text-fp-text-2 tabular-nums"
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}
