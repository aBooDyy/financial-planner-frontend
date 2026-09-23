import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  overMessage,
  rateLine,
  receiveLabel,
  submitLabel,
} from '#/features/balances/data/transferDialog'
import type {
  TransferPreview,
  TransferWallet,
} from '#/features/balances/data/transferDialog'
import type { TransferDialogState } from '#/features/balances/hooks/useTransferDialog'
import type { RatesMap } from '#/lib/config/rates'
import type { DateFormat } from '#/lib/date'
import { TransferAccountPair } from './TransferAccountPair'
import { TransferAmountChips } from './TransferAmountChips'
import { TransferAmountDate } from './TransferAmountDate'
import { TransferFxBox } from './TransferFxBox'

type Props = {
  t: TransferDialogState
  from: TransferWallet
  to: TransferWallet
  preview: TransferPreview
  rates: RatesMap
  dateFormat: DateFormat
}

/** The "Transfer money" form: accounts, amount + date, quick picks, FX, note, submit. */
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
      onSubmit={(e) => {
        e.preventDefault()
        void t.submit()
      }}
    >
      <TransferAccountPair
        wallets={t.wallets}
        from={from}
        to={to}
        preview={preview}
        onFrom={t.pickFrom}
        onTo={t.pickTo}
        onSwap={t.swap}
      />

      <TransferAmountDate
        amount={t.amount}
        currency={from.currency}
        over={preview.over}
        onAmount={t.changeAmount}
        date={t.date}
        dateFormat={dateFormat}
        onDate={t.setDate}
      />

      {preview.over ? (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-fp-danger"
        >
          {overMessage(from)}
        </p>
      ) : null}

      <TransferAmountChips chips={t.chips} onPick={t.pickChip} />

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

      <Input
        value={t.note}
        onChange={(e) => t.setNote(e.target.value)}
        placeholder="Note (optional) — e.g. Monthly savings"
        aria-label="Note"
        maxLength={200}
        className="mt-3 rounded-[11px] px-3 py-[11px] text-[13.5px]"
      />

      <Button
        type="submit"
        disabled={!preview.canSubmit || t.busy}
        className="mt-4 w-full rounded-[13px] py-[13px] text-[14.5px] font-extrabold text-white shadow-[0_6px_16px_-6px_var(--fp-accent)] disabled:bg-fp-surface-2 disabled:text-fp-text-3 disabled:opacity-100 disabled:shadow-none"
      >
        {submitLabel(t.amountMinor, from.currency)}
      </Button>
      <p className="mt-[10px] text-center text-[11.5px] text-fp-text-3">
        Shows in Spending history as a transfer · not counted as spending or
        income
      </p>
    </form>
  )
}
