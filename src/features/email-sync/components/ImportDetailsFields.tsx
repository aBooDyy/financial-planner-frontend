import type { ImportReview } from '#/features/email-sync/hooks/useImportReview'
import type { TxType } from '#/features/transactions/api/types'
import { subcategoriesOf } from '#/features/transactions/categories'
import type { CurrencyCode } from '#/lib/currency'
import { SUPPORTED_CURRENCIES } from '#/lib/currency'
import { DateField } from '#/components/DateField'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { usePreferencesStore } from '#/stores/preferences'

const LABEL = 'mb-[5px] block text-[11.5px] font-semibold text-fp-text-2'
const NONE = '__none__'

const typeBtn = (active: boolean) =>
  `flex-1 rounded-[7px] py-[6px] text-[12.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

/**
 * The values behind one alert — prefilled from the parse, blank when it found none. Account
 * and category sit in the row itself; everything else is here.
 */
export function ImportDetailsFields({ review }: { review: ImportReview }) {
  const { draft, setField, setType } = review
  const subs = subcategoriesOf(draft.category)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <div className="col-span-2 inline-flex w-full rounded-[10px] border border-fp-border bg-fp-surface-2 p-[3px]">
        {(['spend', 'income'] as TxType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={typeBtn(draft.type === t)}
          >
            {t === 'spend' ? 'Spend' : 'Income'}
          </button>
        ))}
      </div>

      <div>
        <Label className={LABEL}>Amount</Label>
        <Input
          value={draft.amount}
          onChange={(e) => setField('amount', e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="tabular-nums"
        />
      </div>
      <div>
        <Label className={LABEL}>Currency</Label>
        <Select
          value={draft.currency}
          onValueChange={(v) => setField('currency', v as CurrencyCode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className={LABEL}>Date</Label>
        <DateField
          value={draft.date}
          onChange={(iso) => setField('date', iso)}
          dateFormat={dateFormat}
          ariaLabel="Date"
        />
      </div>
      <div>
        <Label className={LABEL}>Merchant</Label>
        <Input
          value={draft.merchant}
          onChange={(e) => setField('merchant', e.target.value)}
          placeholder="Who was paid"
        />
      </div>

      {subs.length > 0 ? (
        <div className="col-span-2">
          <Label className={LABEL}>
            Subcategory{' '}
            <span className="font-medium text-fp-text-3">(optional)</span>
          </Label>
          <Select
            value={draft.subcategory ?? NONE}
            onValueChange={(v) => setField('subcategory', v === NONE ? null : v)}
          >
            <SelectTrigger>
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

      <div className="col-span-2">
        <Label className={LABEL}>
          Note <span className="font-medium text-fp-text-3">(optional)</span>
        </Label>
        <Input
          value={draft.note}
          onChange={(e) => setField('note', e.target.value)}
          placeholder="Defaults to the email subject"
        />
      </div>
    </div>
  )
}
