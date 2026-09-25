import { IconChip } from '#/components/icons/IconChip'
import type { AdjustPreview } from '#/features/balances/data/adjustBalance'
import type { TransferWallet } from '#/features/balances/data/transferDialog'
import { formatMoney } from '#/lib/currency'

type Props = {
  wallet: TransferWallet
  preview: AdjustPreview
}

/** The wallet being corrected: its balance now, struck through once a new one is typed. */
export function AdjustWalletCard({ wallet, preview }: Props) {
  const changed = preview.difference !== 0
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-fp-border-strong bg-fp-surface px-[14px] py-3">
      <IconChip id={wallet.icon} color={wallet.color} size={34} iconSize={17} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-bold tracking-[0.05em] text-fp-text-3">
          WALLET
        </span>
        <span className="truncate text-[14.5px] font-bold text-fp-text">
          {wallet.name}
        </span>
      </span>
      <span className="flex flex-none flex-col items-end whitespace-nowrap tabular-nums">
        {changed ? (
          <span className="text-[12px] text-fp-text-3 line-through">
            {formatMoney(preview.current, wallet.currency)}
          </span>
        ) : null}
        <span
          className={
            changed
              ? 'text-[14px] font-bold text-fp-accent-ink'
              : 'text-[14px] font-bold text-fp-text'
          }
        >
          {formatMoney(preview.next, wallet.currency)}
        </span>
      </span>
    </div>
  )
}
