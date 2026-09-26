import { IconChip } from '#/components/icons/IconChip'
import type { AdjustPreview } from '#/features/wallets/data/adjustBalance'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { formatMoney } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  wallet: TransferWallet
  preview: AdjustPreview
}

/** The wallet being corrected: its balance now, struck through once a new one is typed. */
export function AdjustWalletCard({ wallet, preview }: Props) {
  const changed = preview.difference !== 0
  return (
    <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-fp-border px-[14px] py-3">
      <IconChip id={wallet.icon} color={wallet.color} size={34} iconSize={17} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10.5px] font-bold tracking-[0.06em] text-fp-text-3">
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
          className={cn(
            'text-[14px] font-extrabold',
            changed ? 'text-fp-accent-ink' : 'text-fp-text',
          )}
        >
          {formatMoney(preview.next, wallet.currency)}
        </span>
      </span>
    </div>
  )
}
