import type { BalanceRow } from '#/features/wallets/data/selectors'
import { cn } from '#/lib/utils'

/**
 * "Set aside 1,900.00 · Free to spend 3,500.00" under a wallet's or group's balance — or, when
 * more is set aside than the balance holds, "Set aside 5,600.00 · SR 200.00 over" in red.
 */
export function WalletSetAsideLine({ row }: { row: BalanceRow }) {
  return (
    <div
      className={cn(
        'fp-sensitive mt-[2px] flex flex-wrap gap-x-[6px] text-[11.5px] tabular-nums',
        row.overCommitted ? 'font-semibold text-fp-danger' : 'text-fp-text-3',
      )}
    >
      <span className="whitespace-nowrap">Set aside {row.setAsideStr}</span>
      {/* The dot travels with the second half, so a wrapped line never ends on it. */}
      <span className="whitespace-nowrap">
        <span aria-hidden>· </span>
        {row.overCommitted ? row.overStr : `Free to spend ${row.freeStr}`}
      </span>
    </div>
  )
}
