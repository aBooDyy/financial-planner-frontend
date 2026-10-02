import { ArrowRight } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import type { ComingUpWallet } from '#/features/wallets/data/comingUp'
import { ComingUpAlertLine } from './ComingUpAlertLine'
import { ComingUpItemRow } from './ComingUpItemRow'

/** One wallet's next 30 days: Free to spend now → where it ends up, and what moves it. */
export function ComingUpWalletBlock({ wallet }: { wallet: ComingUpWallet }) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-center gap-[10px]">
        <IconChip
          id={wallet.icon}
          color={wallet.color}
          size={30}
          iconSize={15}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold">{wallet.name}</div>
          <div className="fp-sensitive flex flex-wrap items-center gap-x-[6px] text-[12px] text-fp-text-2 tabular-nums">
            <span className="whitespace-nowrap text-fp-text-3">Free</span>
            <span className="whitespace-nowrap">{wallet.nowStr}</span>
            <span className="sr-only">to</span>
            <ArrowRight
              aria-hidden
              size={12}
              strokeWidth={2.2}
              className="shrink-0 text-fp-text-3 rtl:rotate-180"
            />
            <span className="font-bold whitespace-nowrap text-fp-text">
              {wallet.afterStr}
            </span>
          </div>
        </div>
      </div>
      {wallet.alert ? <ComingUpAlertLine alert={wallet.alert} /> : null}
      <ul className="flex flex-col gap-[6px]">
        {wallet.items.map((item) => (
          <ComingUpItemRow key={item.id} item={item} />
        ))}
      </ul>
      {wallet.moreCount > 0 ? (
        <div className="text-[12px] text-fp-text-3">
          +{wallet.moreCount} more
        </div>
      ) : null}
    </div>
  )
}
