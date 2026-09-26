import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DateField } from '#/components/DateField'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { ImportReview } from '#/features/inbound-imports/hooks/useImportReview'
import type { TxType } from '#/features/transactions/api/types'
import { TYPE_TINT } from '#/features/transactions/data/txDialog'
import { amountInputProps } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'

const NONE = '__none__'

const TYPES = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
] as const

/**
 * The values behind one import — prefilled from the parse, blank when it found none. Account
 * and category sit in the row itself; everything else is here.
 */
export function ImportDetailsFields({
  id,
  review,
}: {
  id: string
  review: ImportReview
}) {
  const {
    draft,
    subs,
    subcategoryId,
    setField,
    setSubcategory,
    setType,
    amountError,
  } = review
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <div className="flex flex-col gap-[14px]">
      <PillSwitch<TxType>
        label="Type"
        options={TYPES}
        value={draft.type}
        onChange={setType}
        color={TYPE_TINT[draft.type].ink}
      />

      <div className="grid grid-cols-2 items-start gap-3">
        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-[14px] flex items-center text-[13px] font-extrabold text-fp-text-3"
            >
              {draft.currency}
            </span>
            <Input
              id={`${id}-amount`}
              value={draft.amount}
              {...amountInputProps(draft.currency, (v) =>
                setField('amount', v),
              )}
              aria-invalid={amountError ? true : undefined}
              className="ps-[52px] tabular-nums"
            />
          </div>
          <FieldMessage error={amountError} />
        </div>
        <div className="min-w-0">
          <FieldLabel>Currency</FieldLabel>
          <CurrencyPicker
            value={draft.currency}
            onChange={(code) => setField('currency', code)}
          />
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

        {subs.length > 0 ? (
          <div className="min-w-0">
            <FieldLabel htmlFor={`${id}-subcategory`} optional>
              Subcategory
            </FieldLabel>
            <Select
              value={subcategoryId ?? NONE}
              onValueChange={(v) => setSubcategory(v === NONE ? null : v)}
            >
              <SelectTrigger id={`${id}-subcategory`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {subs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className={subs.length > 0 ? 'min-w-0' : 'col-span-2 min-w-0'}>
          <FieldLabel htmlFor={`${id}-note`} optional>
            Note
          </FieldLabel>
          <Input
            id={`${id}-note`}
            value={draft.note}
            onChange={(e) => setField('note', e.target.value)}
            placeholder={
              review.hasSubject
                ? 'Defaults to the subject'
                : 'Defaults to the merchant'
            }
          />
        </div>
      </div>
    </div>
  )
}
