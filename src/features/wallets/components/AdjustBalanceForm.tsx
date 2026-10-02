import { TriangleAlert } from 'lucide-react'
import { DateField } from '#/components/DateField'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { adjustSubmitLabel } from '#/features/wallets/data/adjustBalance'
import type { AdjustPreview } from '#/features/wallets/data/adjustBalance'
import { adjustWarning } from '#/features/wallets/data/setAsideMoves'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import type { AdjustBalanceState } from '#/features/wallets/hooks/useAdjustBalance'
import type { DateFormat } from '#/lib/date'
import { AmountWell } from '#/components/dialog/AmountWell'
import { AdjustDifferenceBox } from './AdjustDifferenceBox'
import { AdjustWalletCard } from './AdjustWalletCard'
import { BodySubmit } from './BodySubmit'

type Props = {
  a: AdjustBalanceState
  wallet: TransferWallet
  preview: AdjustPreview
  dateFormat: DateFormat
  /** What the wallet holds set aside, in its currency. */
  setAside: number
}

/** The "Adjust balance" form: the wallet, its real balance, date + difference, note, submit. */
export function AdjustBalanceForm({
  a,
  wallet,
  preview,
  dateFormat,
  setAside,
}: Props) {
  const warning = preview.hasTarget
    ? adjustWarning(wallet.name, preview.next, setAside, wallet.currency)
    : null
  return (
    <form
      className="flex flex-col gap-[14px]"
      onSubmit={(e) => {
        e.preventDefault()
        void a.submit()
      }}
    >
      <AdjustWalletCard wallet={wallet} preview={preview} />

      <AmountWell
        question="What does it really hold?"
        tone="neutral"
        signed
        currency={wallet.currency}
        amount={a.actual}
        onAmount={a.setActual}
      />

      {warning ? (
        <NoteBox tone="danger" icon={<TriangleAlert />}>
          {warning}
        </NoteBox>
      ) : null}

      <div className="grid grid-cols-2 items-start gap-3">
        <FormRow id="adjust-date" label="Date">
          <DateField
            value={a.date}
            onChange={(iso) => {
              if (iso) a.setDate(iso)
            }}
            dateFormat={dateFormat}
            ariaLabel="Date"
            hint
          />
        </FormRow>
        <AdjustDifferenceBox preview={preview} currency={wallet.currency} />
      </div>

      <FormRow id="adjust-note" label="Note" optional>
        <Input
          id="adjust-note"
          value={a.note}
          onChange={(e) => a.setNote(e.target.value)}
          placeholder="e.g. Matched bank statement"
          maxLength={200}
        />
      </FormRow>

      <BodySubmit
        label={adjustSubmitLabel(preview)}
        disabled={!preview.canSubmit || a.busy}
        caption="Shows in Spending history as a balance adjustment · not counted as spending or income"
      />
    </form>
  )
}
