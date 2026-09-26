import { ArrowDownUp } from 'lucide-react'
import { TransferFxBox } from '#/features/wallets/components/TransferFxBox'
import { rateLine } from '#/features/wallets/data/transferDialog'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { SAME_ACCOUNT_ERROR } from '#/features/transactions/data/transferForm'
import type { TxEditorDraft } from '#/features/transactions/hooks/useTxEditor'
import type { RatesMap } from '#/lib/config/rates'
import { parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import { Input } from '#/components/ui/input'
import { NOTE_INPUT } from '#/features/transactions/data/txDialog'
import { TransferSideCard } from './TransferSideCard'
import { TxDateChips } from './TxDateChips'
import { TxSection } from './TxSection'

const NOTE_MAX = 200

type Props = {
  draft: TxEditorDraft
  accounts: ReadonlyArray<TransferWallet>
  fromCurrency: CurrencyCode
  missingSide?: 'from' | 'to'
  rates: RatesMap
  dateFormat: DateFormat
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onSwap: () => void
  onResetReceived: () => void
}

/** A transfer's body under the amount: what arrives, from where to where, when, and a note. */
export function TxTransferFields({
  draft,
  accounts,
  fromCurrency,
  missingSide,
  rates,
  dateFormat,
  onField,
  onSwap,
  onResetReceived,
}: Props) {
  const byId = (id: string) => accounts.find((w) => w.id === id) ?? null
  const from = byId(draft.walletId)
  const to = byId(draft.toWalletId)
  const sameAccount = from !== null && from.id === to?.id
  const isFx = !missingSide && !!from && !!to && from.currency !== to.currency

  return (
    <>
      {isFx ? (
        <TransferFxBox
          label={`RECEIVED (${to.currency})`}
          currency={to.currency}
          value={draft.toAmount}
          onChange={(v) => onField('toAmount', v)}
          rate={rateLine(
            fromCurrency,
            to.currency,
            parseAmountToMinor(draft.amount, fromCurrency) ?? 0,
            parseAmountToMinor(draft.toAmount, to.currency) ?? 0,
            rates,
          )}
          edited={draft.toAmountEdited}
          onReset={onResetReceived}
        />
      ) : null}

      <div>
        <div className="relative flex flex-col gap-2">
          <TransferSideCard
            label="FROM"
            wallet={from}
            locked={missingSide === 'from'}
            options={accounts}
            onPick={(id) => onField('walletId', id)}
            invalid={sameAccount}
          />
          {missingSide ? null : (
            <button
              type="button"
              onClick={onSwap}
              title="Swap accounts"
              aria-label="Swap accounts"
              className="absolute end-[52px] top-1/2 z-[2] flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-fp-border-strong bg-fp-surface text-fp-text-2 transition hover:border-fp-accent hover:text-fp-accent-ink"
            >
              <ArrowDownUp size={15} strokeWidth={2} />
            </button>
          )}
          <TransferSideCard
            label="TO"
            wallet={to}
            locked={missingSide === 'to'}
            options={accounts}
            onPick={(id) => onField('toWalletId', id)}
            invalid={sameAccount}
          />
        </div>
        {sameAccount ? (
          <p className="mt-2 text-[12.5px] font-semibold text-fp-danger">
            {SAME_ACCOUNT_ERROR}
          </p>
        ) : null}
      </div>

      <TxSection label="When?">
        <TxDateChips
          value={draft.date}
          onChange={(iso) => onField('date', iso)}
          dateFormat={dateFormat}
        />
      </TxSection>

      <div className="relative">
        <Input
          value={draft.note}
          onChange={(e) => onField('note', e.target.value)}
          maxLength={NOTE_MAX}
          aria-label="Note"
          placeholder="Add a note (optional), e.g. ATM withdrawal"
          className={`${NOTE_INPUT} pe-16`}
        />
        <span className="pointer-events-none absolute end-[14px] top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-fp-text-3 tabular-nums">
          {draft.note.length}/{NOTE_MAX}
        </span>
      </div>

      <p className="text-[12px] leading-[1.5] text-fp-text-3">
        {missingSide
          ? 'The other account was deleted — only this side can change.'
          : 'Category is hidden for transfers. Excluded from budgets and Spent / Income.'}
      </p>
    </>
  )
}
