import { EXTERNAL } from '#/features/planned/hooks/useConfirmForm'
import type { ConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { amountInputProps, formatMoney } from '#/lib/currency'
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
import { EffectLine } from './EffectLine'

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const NONE = '__none__'

/** The 1d inputs: amount (with "of X"), wallet (or an external source), date, effect line. */
export function ConfirmPlannedFields({ f }: { f: ConfirmForm }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  if (!f.form || !f.item) return null
  const { form, item } = f
  const isIncome = item.role === 'income'

  return (
    <>
      <div>
        <div className="flex items-baseline justify-between">
          <Label className={LABEL} htmlFor="confirm-amount">
            Amount
          </Label>
          <span className="text-[12px] text-fp-text-3 tabular-nums">
            of {formatMoney(item.amount, item.currency)}
          </span>
        </div>
        <div className="relative">
          <Input
            id="confirm-amount"
            value={form.amount}
            onChange={(e) => f.setAmount(e.target.value)}
            {...amountInputProps(item.currency)}
            className="pe-14 text-[16px] font-bold tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-[12px] font-semibold text-fp-text-3">
            {item.currency}
          </span>
        </div>
      </div>

      <div className="flex gap-[10px]">
        <div className="min-w-0 flex-1">
          <Label className={LABEL}>{isIncome ? 'Into' : 'From'}</Label>
          <Select
            value={form.source || NONE}
            onValueChange={(v) => f.setSource(v === NONE ? '' : v)}
          >
            <SelectTrigger aria-label={isIncome ? 'Into' : 'From'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.wallets.length === 0 ? (
                <SelectItem value={NONE}>No wallets yet</SelectItem>
              ) : null}
              {f.wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
              {f.allowExternal ? (
                <SelectItem value={EXTERNAL}>External…</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[44%]">
          <Label className={LABEL}>{isIncome ? 'Received' : 'Paid'}</Label>
          <DateField
            value={form.date}
            onChange={f.setDate}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>
      </div>

      {form.source === EXTERNAL ? (
        <div>
          <Label className={LABEL} htmlFor="confirm-external">
            Held where
          </Label>
          <Input
            id="confirm-external"
            value={form.externalLabel}
            onChange={(e) => f.setExternalLabel(e.target.value)}
            placeholder="e.g. Dad's help, cash at home"
          />
        </div>
      ) : null}

      {f.effect ? <EffectLine effect={f.effect} /> : null}
      {f.error ? (
        <p role="alert" className="text-[12.5px] text-fp-danger">
          {f.error}
        </p>
      ) : null}
    </>
  )
}
