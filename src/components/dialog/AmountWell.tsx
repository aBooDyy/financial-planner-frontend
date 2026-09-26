import type { ReactNode } from 'react'
import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'

export type AmountTone = 'accent' | 'spend' | 'transfer' | 'neutral'

const TONE: Record<AmountTone, { soft: string; ink: string }> = {
  accent: { soft: 'var(--fp-accent-soft)', ink: 'var(--fp-accent-ink)' },
  spend: { soft: 'var(--fp-spend-soft)', ink: 'var(--fp-spend)' },
  transfer: { soft: 'var(--fp-transfer-soft)', ink: 'var(--fp-transfer)' },
  neutral: { soft: 'var(--fp-surface-2)', ink: 'var(--fp-text-2)' },
}

type Props = {
  question: string
  currency: CurrencyCode
  amount: string
  onAmount: (value: string) => void
  invalid?: boolean
  tone?: AmountTone
  /** Where the currency sits: its symbol before the figure, or its code after it. */
  unit?: 'symbol' | 'code'
  autoFocus?: boolean
  /** Accepts a minus, for a figure that can really be below zero (a card's balance). */
  signed?: boolean
  /** Under the figure: a currency or account pill. */
  children?: ReactNode
}

/** A dialog's lead when money is the point: the amount, large and centred on a tint. */
export function AmountWell({
  question,
  currency,
  amount,
  onAmount,
  invalid,
  tone = 'accent',
  unit = 'symbol',
  autoFocus,
  signed,
  children,
}: Props) {
  const { soft, ink } = TONE[tone]
  const unitNode = (
    <span
      className={cn(
        'flex-none font-extrabold',
        unit === 'symbol' ? 'text-[18px]' : 'text-[17px]',
      )}
      style={{ color: ink }}
    >
      {unit === 'symbol' ? currencySymbol(currency) : currency}
    </span>
  )

  return (
    <div
      className={cn(
        'rounded-[20px] border-[1.5px] px-4 pt-4 pb-[14px] text-center',
        invalid ? 'border-fp-danger' : 'border-transparent',
      )}
      style={{ background: invalid ? 'var(--fp-spend-soft)' : soft }}
    >
      <div className="text-[13px] font-bold text-fp-text-2">{question}</div>
      <label className="mt-1 flex min-w-0 cursor-text items-baseline justify-center gap-2">
        {unit === 'symbol' ? unitNode : null}
        <input
          value={amount}
          aria-label={question}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus}
          {...amountInputProps(currency, onAmount, { signed })}
          style={{ width: `${Math.max(4, amount.length + 0.6)}ch` }}
          className="max-w-full min-w-0 border-none bg-transparent p-0 text-center text-[40px] font-extrabold tracking-[-0.03em] text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
        />
        {unit === 'code' ? unitNode : null}
      </label>
      {children ? (
        <div className="mt-2 flex justify-center">{children}</div>
      ) : null}
    </div>
  )
}
