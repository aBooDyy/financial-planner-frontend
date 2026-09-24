import { EXTERNAL } from '#/features/goals/hooks/useContributionForm'
import type { ContributionForm } from '#/features/goals/hooks/useContributionForm'
import { amountInputProps } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
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
import { FIELD_LABEL } from '../styles'

const NONE = '__none__'

/** 1b's inputs: amount in the goal's currency, where it comes from, and when. */
export function ContributionFields({
  f,
  currency,
}: {
  f: ContributionForm
  currency: CurrencyCode
}) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <>
      <div>
        <Label className={FIELD_LABEL} htmlFor="contribution-amount">
          Amount
        </Label>
        <div className="relative">
          <Input
            id="contribution-amount"
            value={f.amount}
            onChange={(e) => f.setAmount(e.target.value)}
            {...amountInputProps(currency)}
            autoFocus
            className="pe-14 text-[20px] font-extrabold tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-[12px] font-semibold text-fp-text-3">
            {currency}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <Label className={FIELD_LABEL}>From</Label>
          <Select
            value={f.source || NONE}
            onValueChange={(v) => f.setSource(v === NONE ? '' : v)}
          >
            <SelectTrigger aria-label="From">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.mode === 'later' || f.wallets.length === 0 ? (
                <SelectItem value={NONE}>
                  {f.wallets.length === 0 ? 'No wallets yet' : 'Decide later'}
                </SelectItem>
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
        <div className="min-w-0">
          <Label className={FIELD_LABEL}>Date</Label>
          <DateField
            value={f.date}
            onChange={f.setDate}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>
      </div>

      {f.isExternal ? (
        <div>
          <Label className={FIELD_LABEL} htmlFor="contribution-external">
            Held where
          </Label>
          <Input
            id="contribution-external"
            value={f.externalLabel}
            onChange={(e) => f.setExternalLabel(e.target.value)}
            placeholder="e.g. Dad's help, cash at home"
          />
        </div>
      ) : null}
    </>
  )
}
