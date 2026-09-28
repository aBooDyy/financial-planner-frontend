import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  label: string
  currency: CurrencyCode
  value: string
  onChange: (value: string) => void
  rate: string
  edited: boolean
  onReset: () => void
}

/** What the destination receives when the currencies differ; editable to match the bank. */
export function TransferFxBox({
  label,
  currency,
  value,
  onChange,
  rate,
  edited,
  onReset,
}: Props) {
  return (
    <div className="flex items-center gap-[10px] rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface-2 px-[14px] py-3">
      <label className="block min-w-0 flex-1">
        <span className="block truncate text-[11px] font-bold tracking-[0.06em] text-fp-text-3">
          {label}
        </span>
        <span className="flex items-baseline gap-[5px]">
          <span className="text-[15px] font-bold text-fp-text-3">
            {currencySymbol(currency)}
          </span>
          <input
            aria-label={`Received (${currency})`}
            {...amountInputProps(currency, value, onChange)}
            className="w-full min-w-0 flex-1 border-none bg-transparent text-[17px] font-extrabold text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
          />
        </span>
      </label>
      <div className="flex-none text-end text-[12px] whitespace-nowrap text-fp-text-2 tabular-nums">
        {rate}
        {edited ? (
          <div className="text-[11px] text-fp-text-3">
            edited ·{' '}
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-fp-accent-ink"
            >
              reset
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
