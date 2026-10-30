import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/wallets/data/selectors'
import { cn } from '#/lib/utils'

/**
 * "Set aside 1,900.00 · Free to spend 3,500.00" under a wallet's or group's balance — or, when
 * more is set aside than the balance holds, "Set aside 5,600.00 · SR 200.00 over" in red.
 */
export function WalletSetAsideLine({
  row,
  onFix,
}: {
  row: BalanceRow
  /** Offers Fix next to the "over" figure. */
  onFix?: () => void
}) {
  return (
    <div
      className={cn(
        'mt-[2px] flex flex-wrap items-center gap-x-[6px] text-[11.5px] tabular-nums',
        row.overCommitted ? 'font-semibold text-fp-danger' : 'text-fp-text-3',
      )}
    >
      <span className="fp-sensitive whitespace-nowrap">
        Set aside {row.setAsideStr}
      </span>
      {/* The dot travels with the second half, so a wrapped line never ends on it. */}
      <span className="fp-sensitive whitespace-nowrap">
        <span aria-hidden>· </span>
        {row.overCommitted ? row.overStr : `Free to spend ${row.freeStr}`}
      </span>
      {row.overCommitted && onFix ? (
        <Button
          type="button"
          variant="danger-soft"
          size="xs"
          aria-label={`Fix ${row.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onFix()
          }}
          className="h-[22px] rounded-[7px] px-2 text-[11.5px] font-bold"
        >
          Fix
        </Button>
      ) : null}
    </div>
  )
}
