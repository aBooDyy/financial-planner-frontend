import type { ReactNode } from 'react'
import { amountInputProps } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  question: string
  currency: CurrencyCode
  amount: string
  onAmount: (value: string) => void
  invalid: boolean
  /** Under the figure: the account pill of a spend or income entry. */
  children?: ReactNode
}

/** The dialog's lead: the amount, large and centred on the type's tint. */
export function TxAmountHero({
  question,
  currency,
  amount,
  onAmount,
  invalid,
  children,
}: Props) {
  const input = amountInputProps(currency, amount, onAmount)
  return (
    <div
      className={cn(
        'rounded-[20px] border-[1.5px] bg-(--tx-soft) px-4 pt-4 pb-[14px] text-center',
        invalid ? 'border-fp-danger' : 'border-transparent',
      )}
    >
      <div className="text-[13px] font-bold text-fp-text-2">{question}</div>
      <label className="mt-1 flex min-w-0 cursor-text items-baseline justify-center gap-2">
        <span className="flex-none text-[18px] font-extrabold text-(--tx-ink)">
          {currency}
        </span>
        <input
          aria-label="Amount"
          {...input}
          style={{ width: `${Math.max(4, input.value.length + 0.6)}ch` }}
          className="max-w-full min-w-0 border-none bg-transparent p-0 text-center text-[46px] font-extrabold tracking-[-0.03em] text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
        />
      </label>
      {children ? (
        <div className="mt-2 flex justify-center">{children}</div>
      ) : null}
    </div>
  )
}
