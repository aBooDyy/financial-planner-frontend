import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatDate, parseISODate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { cn } from '#/lib/utils'

type Props = {
  amount: string
  currency: CurrencyCode
  over: boolean
  onAmount: (value: string) => void
  date: string
  dateFormat: DateFormat
  onDate: (iso: string) => void
}

const CAPTION = 'block text-[11px] font-bold tracking-[0.05em] text-fp-text-3'

/** The AMOUNT box (the dialog's focus) beside the DATE box. */
export function TransferAmountDate({
  amount,
  currency,
  over,
  onAmount,
  date,
  dateFormat,
  onDate,
}: Props) {
  const parsed = parseISODate(date)
  return (
    <div className="mt-[14px] grid grid-cols-[minmax(0,1fr)_150px] gap-[10px] max-[360px]:grid-cols-[minmax(0,1fr)_120px]">
      <label
        className={cn(
          'block rounded-[13px] border-[1.5px] px-[14px] py-[10px]',
          over
            ? 'border-fp-danger shadow-[0_0_0_4px_color-mix(in_oklab,var(--fp-danger)_12%,transparent)]'
            : 'border-fp-accent shadow-[0_0_0_4px_var(--fp-accent-soft)]',
        )}
      >
        <span className={CAPTION}>AMOUNT</span>
        <span className="flex items-baseline gap-[5px]">
          <span className="text-[18px] font-bold text-fp-text-3">
            {currencySymbol(currency)}
          </span>
          <input
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            aria-label="Amount"
            aria-invalid={over || undefined}
            {...amountInputProps(currency)}
            className="w-full min-w-0 flex-1 border-none bg-transparent text-[24px] font-extrabold tracking-[-0.02em] text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
          />
        </span>
      </label>
      <label className="relative block rounded-[13px] border border-fp-border-strong px-3 py-[10px] focus-within:border-fp-accent">
        <span className={CAPTION}>DATE</span>
        <span className="block truncate pt-1 text-[14px] font-bold text-fp-text tabular-nums">
          {parsed ? formatDate(parsed, dateFormat) : 'Pick a date'}
        </span>
        <input
          type="date"
          value={date}
          aria-label="Date"
          onChange={(e) => {
            if (e.target.value) onDate(e.target.value)
          }}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker()
            } catch {
              // Unavailable on older browsers; the native click still opens it.
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
