import { ChevronDown } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { AccountMenuTree } from '#/features/transactions/components/AccountMenuTree'
import { useAccountSections } from '#/features/transactions/hooks/useAccountSections'
import type {
  AfterTone,
  TransferWallet,
} from '#/features/wallets/data/transferDialog'
import { formatMoney } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  label: 'FROM' | 'TO'
  wallet: TransferWallet
  options: TransferWallet[]
  onPick: (id: string) => void
  showBefore: boolean
  after: number
  tone: AfterTone
}

const TONE: Record<AfterTone, string> = {
  muted: 'text-fp-text-2',
  text: 'text-fp-text',
  accent: 'text-fp-accent-ink',
  danger: 'text-fp-danger',
}

/** One side of the transfer. The whole card is the wallet picker. */
export function TransferAccountCard({
  label,
  wallet,
  options,
  onPick,
  showBefore,
  after,
  tone,
}: Props) {
  const { sections, amountsLoading } = useAccountSections(options)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label === 'FROM' ? 'From' : 'To'} account: ${wallet.name}`}
        className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface px-[14px] py-[11px] text-start outline-none transition hover:border-fp-border-strong focus-visible:border-fp-accent focus-visible:shadow-[0_0_0_3px_var(--fp-accent-soft)]"
      >
        <IconChip
          id={wallet.icon}
          color={wallet.color}
          size={34}
          iconSize={17}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-bold tracking-[0.06em] text-fp-text-3">
            {label}
          </span>
          <span className="flex min-w-0 items-center gap-[5px] text-[14.5px] font-bold text-fp-text">
            <span className="truncate">{wallet.name}</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="flex-none text-fp-text-3"
            />
          </span>
        </span>
        <span className="flex flex-none flex-col items-end whitespace-nowrap tabular-nums">
          {showBefore ? (
            <span className="text-[12px] text-fp-text-3 line-through">
              {formatMoney(wallet.balance, wallet.currency)}
            </span>
          ) : null}
          <span className={cn('text-[14px] font-extrabold', TONE[tone])}>
            {formatMoney(after, wallet.currency)}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-[260px]"
      >
        <DropdownMenuRadioGroup value={wallet.id} onValueChange={onPick}>
          <AccountMenuTree sections={sections} amountsLoading={amountsLoading} />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
