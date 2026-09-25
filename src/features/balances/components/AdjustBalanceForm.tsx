import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { adjustSubmitLabel } from '#/features/balances/data/adjustBalance'
import type { AdjustPreview } from '#/features/balances/data/adjustBalance'
import type { TransferWallet } from '#/features/balances/data/transferDialog'
import type { AdjustBalanceState } from '#/features/balances/hooks/useAdjustBalance'
import type { DateFormat } from '#/lib/date'
import { AdjustDifferenceBox } from './AdjustDifferenceBox'
import { AdjustWalletCard } from './AdjustWalletCard'
import { TransferAmountDate } from './TransferAmountDate'

type Props = {
  a: AdjustBalanceState
  wallet: TransferWallet
  preview: AdjustPreview
  dateFormat: DateFormat
}

const ACTUAL_LABEL = { caption: 'ACTUAL BALANCE', name: 'Actual balance' }

/** The "Adjust balance" form: the wallet, its real balance + date, the difference, note, submit. */
export function AdjustBalanceForm({ a, wallet, preview, dateFormat }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void a.submit()
      }}
    >
      <AdjustWalletCard wallet={wallet} preview={preview} />

      <TransferAmountDate
        label={ACTUAL_LABEL}
        amount={a.actual}
        currency={wallet.currency}
        over={false}
        onAmount={a.setActual}
        date={a.date}
        dateFormat={dateFormat}
        onDate={a.setDate}
      />

      <AdjustDifferenceBox preview={preview} currency={wallet.currency} />

      <Input
        value={a.note}
        onChange={(e) => a.setNote(e.target.value)}
        placeholder="Note (optional) — e.g. Matched bank statement"
        aria-label="Note"
        maxLength={200}
        className="mt-3 rounded-[11px] px-3 py-[11px] text-[13.5px]"
      />

      <Button
        type="submit"
        disabled={!preview.canSubmit || a.busy}
        className="mt-4 w-full rounded-[13px] py-[13px] text-[14.5px] font-extrabold text-white shadow-[0_6px_16px_-6px_var(--fp-accent)] disabled:bg-fp-surface-2 disabled:text-fp-text-3 disabled:opacity-100 disabled:shadow-none"
      >
        {adjustSubmitLabel(preview)}
      </Button>
      <p className="mt-[10px] text-center text-[11.5px] text-fp-text-3">
        Shows in Spending history as a balance adjustment · not counted as
        spending or income
      </p>
    </form>
  )
}
