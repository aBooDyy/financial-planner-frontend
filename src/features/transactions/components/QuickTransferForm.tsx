import { Plus } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import { useQuickTransfer } from '#/features/transactions/hooks/useQuickTransfer'
import type { RatesMap } from '#/lib/config/rates'
import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { TransferAccountsRow } from './TransferAccountsRow'

type Props = {
  wallets: LocalBalanceNode[]
  base: CurrencyCode
  rates: RatesMap
}

const FIELD =
  'flex flex-none items-center gap-[6px] rounded-[11px] border border-fp-border-strong bg-fp-surface-2 px-[11px] focus-within:border-fp-accent focus-within:shadow-[0_0_0_3px_var(--fp-accent-soft)]'
const AMOUNT_INPUT =
  'w-[78px] border-none bg-transparent py-[11px] text-[18px] font-extrabold tabular-nums text-fp-text outline-none placeholder:text-fp-text-3'

/** The quick-add Transfer tab: amount, From ⇄ To, add. */
export function QuickTransferForm({ wallets, base, rates }: Props) {
  const t = useQuickTransfer(wallets, base, rates)

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className={FIELD}>
          <span className="text-[14px] font-bold text-fp-text-3">
            {currencySymbol(t.fromCurrency)}
          </span>
          <input
            value={t.amount}
            aria-label="Amount"
            {...amountInputProps(t.fromCurrency, t.changeAmount)}
            className={AMOUNT_INPUT}
          />
        </div>
        {t.crossCurrency ? (
          <div className={FIELD} title="Received">
            <span className="text-[14px] font-bold text-fp-text-3">
              {currencySymbol(t.toCurrency)}
            </span>
            <input
              value={t.received}
              aria-label={`Received (${t.toCurrency})`}
              {...amountInputProps(t.toCurrency, t.setReceived)}
              className={AMOUNT_INPUT}
            />
          </div>
        ) : null}
        <div className="min-w-[220px] flex-1">
          <TransferAccountsRow
            wallets={wallets}
            fromId={t.from}
            toId={t.to}
            onFrom={t.pickFrom}
            onTo={t.pickTo}
            onSwap={t.swap}
            invalid={t.sameAccount}
          />
        </div>
        <Button
          type="button"
          onClick={() => void t.add()}
          disabled={!t.valid}
          title="Add transfer"
          aria-label="Add transfer"
          className="min-h-[44px] w-[46px] flex-none rounded-[11px] px-0 py-0 text-white disabled:bg-fp-surface-2 disabled:text-fp-text-3 disabled:opacity-100 disabled:shadow-none [&_svg]:size-5"
        >
          <Plus size={20} strokeWidth={2.4} />
        </Button>
      </div>
      <p
        className={cn(
          'mt-[10px] text-[12px]',
          t.sameAccount ? 'font-semibold text-fp-danger' : 'text-fp-text-3',
        )}
      >
        {t.hint}
      </p>
    </div>
  )
}
