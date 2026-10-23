import { CurrencyPicker } from '#/components/CurrencyPicker'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import type { ReviewCard } from '#/features/inbound-imports/hooks/useReviewQueue'
import type { TxType } from '#/features/transactions/api/types'
import { TYPE_TINT } from '#/features/transactions/data/txDialog'
import { cn } from '#/lib/utils'
import { usePreferencesStore } from '#/stores/preferences'

const TYPES = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
] as const

/** The values that are usually read right — type, merchant, currency, date — for fixing. */
export function ReviewDetailFields({ card }: { card: ReviewCard }) {
  const { item, draft, setField } = card
  const id = `import-${item.id}`
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <>
      <PillSwitch<TxType>
        label="Type"
        options={TYPES}
        value={draft.type}
        onChange={card.setType}
        color={TYPE_TINT[draft.type].ink}
      />

      <div className="min-w-0">
        <FieldLabel htmlFor={`${id}-merchant`} optional>
          Merchant
        </FieldLabel>
        <Input
          id={`${id}-merchant`}
          value={draft.merchant}
          onChange={(e) => setField('merchant', e.target.value)}
          placeholder="Who was paid"
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <div className="min-w-0">
          <FieldLabel>Currency</FieldLabel>
          <CurrencyPicker
            value={draft.currency}
            onChange={(code) => setField('currency', code)}
            className={cn(
              card.currencyMissing && 'border-fp-danger bg-fp-danger/[0.07]',
            )}
          />
          {card.currencyMissing ? (
            <FieldMessage
              error={`Enter it, or tap it in the ${bodyNoun(item.bodyFormat, item.source)} below.`}
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <FieldLabel>Date</FieldLabel>
          <DateField
            value={draft.date}
            onChange={(iso) => setField('date', iso)}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>
      </div>
    </>
  )
}
