import { AmountWell } from '#/components/dialog/AmountWell'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  question: string
  amount: string
  currency: CurrencyCode
  onAmount: (value: string) => void
  onCurrency: (code: CurrencyCode) => void
}

/** The editor's lead: the amount, big, with its currency as a pill beneath. */
export function EditorAmount({
  question,
  amount,
  currency,
  onAmount,
  onCurrency,
}: Props) {
  return (
    <AmountWell
      question={question}
      currency={currency}
      amount={amount}
      onAmount={onAmount}
    >
      <CurrencyPicker
        value={currency}
        onChange={onCurrency}
        align="center"
        appearance="pill"
        prefix="Currency"
      />
    </AmountWell>
  )
}
