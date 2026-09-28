import { CurrencyPicker } from '#/components/CurrencyPicker'
import { FormRow } from '#/components/FormRow'
import { FIELD_WELL } from '#/components/ui/field-well'
import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  label: string
  help?: string
  amount: string
  currency: CurrencyCode
  onAmount: (value: string) => void
  onCurrency: (code: CurrencyCode) => void
}

/** A wallet's amount in one well: its symbol, the figure, and the currency as a pill at the end. */
export function OpeningBalanceField({
  label,
  help,
  amount,
  currency,
  onAmount,
  onCurrency,
}: Props) {
  return (
    <FormRow id="node-amount" label={label} help={help}>
      <div
        className={cn(
          FIELD_WELL,
          'flex items-center gap-[10px] py-[9px] focus-within:border-fp-accent focus-within:ring-[3px] focus-within:ring-fp-accent/15',
        )}
      >
        <span className="flex-none text-[13px] font-extrabold text-fp-text-3">
          {currencySymbol(currency)}
        </span>
        <input
          id="node-amount"
          {...amountInputProps(currency, amount, onAmount, { signed: true })}
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[14px] font-semibold text-fp-text tabular-nums outline-none placeholder:font-medium placeholder:text-fp-text-3"
        />
        <CurrencyPicker
          value={currency}
          onChange={onCurrency}
          label="Currency"
          align="end"
          appearance="pill"
          className="flex-none px-[9px] py-[5px] text-[12.5px]"
        />
      </div>
    </FormRow>
  )
}
