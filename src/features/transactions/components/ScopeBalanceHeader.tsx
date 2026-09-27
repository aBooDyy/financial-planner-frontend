import { Wallet } from 'lucide-react'
import { Fragment } from 'react'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import type { ScopeBalance } from '#/features/transactions/data/scopePicker'

type Props = {
  balance: ScopeBalance
  /** The balances are still being summed; the names are known already. */
  loading: boolean
}

/** The chosen accounts and what they hold, heading the cashflow card. */
export function ScopeBalanceHeader({ balance, loading }: Props) {
  return (
    <div className="mb-4 border-b border-fp-border pb-[14px]">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <Wallet
            size={16}
            strokeWidth={1.8}
            className="flex-none text-fp-text-3"
          />
          <span className="truncate text-[13px] font-semibold text-fp-text-2">
            {balance.label}
          </span>
        </div>
        <span className="fp-sensitive text-[17px] font-extrabold tracking-[-0.01em] whitespace-nowrap tabular-nums">
          <ValueOrSkeleton
            value={loading ? null : balance.amountStr}
            className="h-[18px] w-24"
          />
        </span>
      </div>
      {balance.parts.length > 0 ? (
        <div className="mt-[6px] flex flex-wrap items-center gap-x-2 gap-y-[2px] ps-6 text-[12px] text-fp-text-3">
          {balance.parts.map((part, i) => (
            <Fragment key={part.name + i}>
              {i > 0 ? (
                <span
                  aria-hidden
                  className="h-[3px] w-[3px] rounded-full bg-fp-border-strong"
                />
              ) : null}
              <span className="flex min-w-0 items-center gap-[5px]">
                <span className="truncate">{part.name}</span>
                <span className="fp-sensitive font-semibold whitespace-nowrap text-fp-text-2 tabular-nums">
                  <ValueOrSkeleton
                    value={loading ? null : part.amountStr}
                    className="h-3 w-12"
                  />
                </span>
              </span>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}
