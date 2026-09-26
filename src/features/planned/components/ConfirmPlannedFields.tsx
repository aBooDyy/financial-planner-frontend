import { AmountWell } from '#/components/dialog/AmountWell'
import { NoteBox } from '#/components/dialog/NoteBox'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import { EXTERNAL } from '#/features/planned/hooks/useConfirmForm'
import type { ConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { formatMoney } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { ConfirmWalletSelect } from './ConfirmWalletSelect'
import { EffectLine } from './EffectLine'

/** The 1d inputs: amount (with "of X planned"), wallet (or an external source), date, effect line. */
export function ConfirmPlannedFields({ f }: { f: ConfirmForm }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  if (!f.form || !f.item) return null
  const { form, item } = f
  const isIncome = item.role === 'income'

  return (
    <>
      <AmountWell
        question={
          isIncome ? 'How much came in?' : 'How much are you confirming?'
        }
        currency={item.currency}
        amount={form.amount}
        onAmount={f.setAmount}
      >
        <span className="-mt-[6px] text-[12.5px] font-semibold text-fp-text-2 tabular-nums">
          of {formatMoney(item.amount, item.currency)} planned
        </span>
      </AmountWell>

      <div className="grid grid-cols-[1.3fr_1fr] items-start gap-3">
        <div className="min-w-0">
          <FieldLabel htmlFor="confirm-wallet">
            {isIncome ? 'Into' : 'From'}
          </FieldLabel>
          <ConfirmWalletSelect
            id="confirm-wallet"
            label={isIncome ? 'Into' : 'From'}
            wallets={f.wallets}
            value={form.source}
            allowExternal={f.allowExternal}
            onChange={f.setSource}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel>{isIncome ? 'Received' : 'Paid'}</FieldLabel>
          <DateField
            value={form.date}
            onChange={f.setDate}
            dateFormat={dateFormat}
            ariaLabel="Date"
            hint
          />
        </div>
      </div>

      {form.source === EXTERNAL ? (
        <div>
          <FieldLabel htmlFor="confirm-external">Held where</FieldLabel>
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
        <div role="alert">
          <NoteBox tone="danger">{f.error}</NoteBox>
        </div>
      ) : null}
    </>
  )
}
