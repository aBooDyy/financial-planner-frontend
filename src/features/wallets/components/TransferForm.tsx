import type { CSSProperties } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage, FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import {
  overMessage,
  rateLine,
  receiveLabel,
  submitLabel,
} from '#/features/wallets/data/transferDialog'
import type {
  TransferPreview,
  TransferWallet,
} from '#/features/wallets/data/transferDialog'
import type { TransferDialogState } from '#/features/wallets/hooks/useTransferDialog'
import { TxDateChips } from '#/features/transactions/components/TxDateChips'
import type { RatesMap } from '#/lib/config/rates'
import type { DateFormat } from '#/lib/date'
import { BodySubmit } from './BodySubmit'
import { TransferAccountPair } from './TransferAccountPair'
import { TransferAmountChips } from './TransferAmountChips'
import { TransferFxBox } from './TransferFxBox'

type Props = {
  t: TransferDialogState
  from: TransferWallet
  to: TransferWallet
  preview: TransferPreview
  rates: RatesMap
  dateFormat: DateFormat
}

// `TxDateChips` takes its chosen chip's tint from `--tx-ink`.
const TRANSFER_TINT = { '--tx-ink': 'var(--fp-transfer)' } as CSSProperties

/** The "Transfer money" form: amount first, quick picks, accounts, FX, date, note, submit. */
export function TransferForm({
  t,
  from,
  to,
  preview,
  rates,
  dateFormat,
}: Props) {
  return (
    <form
      className="flex flex-col gap-[14px]"
      style={TRANSFER_TINT}
      onSubmit={(e) => {
        e.preventDefault()
        void t.submit()
      }}
    >
      <div>
        <AmountWell
          question="How much are you moving?"
          currency={from.currency}
          amount={t.amount}
          onAmount={t.changeAmount}
          invalid={preview.over}
          tone="transfer"
        />
        <FieldMessage error={preview.over ? overMessage(from) : null} />
      </div>

      <TransferAmountChips chips={t.chips} onPick={t.pickChip} />

      <TransferAccountPair
        wallets={t.wallets}
        from={from}
        to={to}
        preview={preview}
        onFrom={t.pickFrom}
        onTo={t.pickTo}
        onSwap={t.swap}
      />

      {preview.isFx ? (
        <TransferFxBox
          label={receiveLabel(to)}
          currency={to.currency}
          value={t.received}
          onChange={t.changeReceived}
          rate={rateLine(
            from.currency,
            to.currency,
            t.amountMinor ?? 0,
            preview.received,
            rates,
          )}
          edited={t.receivedEdited}
          onReset={t.resetReceived}
        />
      ) : null}

      <div role="group" aria-label="When?">
        <FieldLabel>When?</FieldLabel>
        <TxDateChips
          value={t.date}
          onChange={t.setDate}
          dateFormat={dateFormat}
        />
      </div>

      <FormRow id="transfer-note" label="Note" optional>
        <Input
          id="transfer-note"
          value={t.note}
          onChange={(e) => t.setNote(e.target.value)}
          placeholder="e.g. Monthly savings"
          maxLength={200}
        />
      </FormRow>

      <BodySubmit
        label={submitLabel(t.amountMinor, from.currency)}
        disabled={!preview.canSubmit || t.busy}
        caption="Shows in Spending history as a transfer · not counted as spending or income"
      />
    </form>
  )
}
