import { numericInputProps } from '#/lib/numericInput'

type Props = {
  value: string
  symbol: string
  placeholder: string
  label: string
  onValue: (value: string) => void
}

/** One end of the amount range, prefixed with the base currency's symbol. */
export function AmountBoundField({
  value,
  symbol,
  placeholder,
  label,
  onValue,
}: Props) {
  return (
    <div className="flex h-[38px] min-w-0 flex-1 items-center gap-[6px] rounded-[10px] border border-fp-border-strong bg-fp-surface px-[10px] focus-within:border-fp-accent">
      <span className="text-[12.5px] font-bold text-fp-text-3">{symbol}</span>
      <input
        value={value}
        placeholder={placeholder}
        aria-label={label}
        {...numericInputProps({}, onValue)}
        className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
      />
    </div>
  )
}
