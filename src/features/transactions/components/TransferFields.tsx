import type { LocalBalanceNode } from '#/db/types'
import type { TxEditorDraft } from '#/features/transactions/hooks/useTxEditor'
import { SAME_ACCOUNT_ERROR } from '#/features/transactions/data/transferForm'
import { amountInputProps } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import { DateField } from '#/components/DateField'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { TransferAccountsRow } from './TransferAccountsRow'

type Props = {
  draft: TxEditorDraft
  wallets: LocalBalanceNode[]
  fromCurrency: CurrencyCode
  toCurrency: CurrencyCode
  dateFormat: DateFormat
  missingSide?: 'from' | 'to'
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onSwap: () => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

/** The transfer body of the editor: what moves, from where to where, and when. */
export function TransferFields({
  draft,
  wallets,
  fromCurrency,
  toCurrency,
  dateFormat,
  missingSide,
  onField,
  onSwap,
}: Props) {
  const sameAccount =
    draft.walletId !== '' && draft.walletId === draft.toWalletId
  const crossCurrency = fromCurrency !== toCurrency

  return (
    <>
      <div className="flex gap-[10px]">
        <div className="flex-1">
          <Label className={LABEL}>Amount</Label>
          <Input
            value={draft.amount}
            onChange={(e) => onField('amount', e.target.value)}
            {...amountInputProps(fromCurrency)}
            className="tabular-nums"
          />
        </div>
        {crossCurrency && !missingSide ? (
          <div className="flex-1">
            <Label className={LABEL}>Received ({toCurrency})</Label>
            <Input
              value={draft.toAmount}
              onChange={(e) => onField('toAmount', e.target.value)}
              {...amountInputProps(toCurrency)}
              className="tabular-nums"
            />
          </div>
        ) : null}
      </div>

      <div>
        <TransferAccountsRow
          wallets={wallets}
          fromId={draft.walletId}
          toId={draft.toWalletId}
          onFrom={(id) => onField('walletId', id)}
          onTo={(id) => onField('toWalletId', id)}
          onSwap={onSwap}
          invalid={sameAccount}
          missing={missingSide}
        />
        {sameAccount ? (
          <p className="mt-2 text-[12.5px] font-semibold text-fp-danger">
            {SAME_ACCOUNT_ERROR}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-[10px] max-[360px]:grid-cols-1">
        <div className="min-w-0">
          <Label className={LABEL}>Date</Label>
          <DateField
            value={draft.date}
            onChange={(iso) => onField('date', iso)}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>
        <div className="min-w-0">
          <Label className={LABEL}>
            Note <span className="font-medium text-fp-text-3">(optional)</span>
          </Label>
          <Input
            value={draft.note}
            onChange={(e) => onField('note', e.target.value)}
            placeholder="e.g. ATM withdrawal"
            maxLength={200}
          />
        </div>
      </div>

      <p className="text-[12px] text-fp-text-3">
        {missingSide
          ? 'The other account was deleted — only this side can change.'
          : 'Category is hidden for transfers. Excluded from budgets and Spent / Income.'}
      </p>
    </>
  )
}
