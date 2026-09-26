import { ChevronDown } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
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
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        <DropdownMenuRadioGroup value={wallet.id} onValueChange={onPick}>
          {options.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id} className="gap-2">
              <span
                className="h-[8px] w-[8px] flex-none rounded-[2px]"
                style={{ background: w.color }}
              />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              <span className="flex-none text-fp-text-3 tabular-nums">
                {formatMoney(w.balance, w.currency)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
