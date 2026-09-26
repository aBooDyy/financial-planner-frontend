import { ChevronDown, Lock } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { formatMoney } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  label: 'FROM' | 'TO'
  wallet: TransferWallet | null
  /** This side's account was deleted: shown, but no longer choosable. */
  locked: boolean
  options: ReadonlyArray<TransferWallet>
  onPick: (id: string) => void
  invalid: boolean
}

const CARD =
  'flex w-full items-center gap-3 rounded-[14px] border-[1.5px] px-[14px] py-[11px] text-start'

function Face({
  label,
  wallet,
  locked,
}: {
  label: string
  wallet: TransferWallet | null
  locked: boolean
}) {
  return (
    <>
      {wallet ? (
        <IconChip
          id={wallet.icon}
          color={wallet.color}
          size={34}
          iconSize={17}
        />
      ) : (
        <span className="size-[34px] flex-none rounded-[10px] bg-fp-border" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-[0.06em] text-fp-text-3">
          {label}
        </span>
        <span
          className={cn(
            'block truncate text-[14.5px] font-bold',
            wallet ? 'text-fp-text' : 'text-fp-text-2',
          )}
        >
          {wallet
            ? wallet.name
            : locked
              ? 'Deleted account'
              : 'Choose an account'}
        </span>
      </span>
      <span className="text-[12.5px] whitespace-nowrap text-fp-text-2 tabular-nums">
        {wallet
          ? formatMoney(wallet.balance, wallet.currency)
          : locked
            ? 'Can’t be changed'
            : null}
      </span>
    </>
  )
}

/** One side of a transfer; the whole card picks the account. */
export function TransferSideCard({
  label,
  wallet,
  locked,
  options,
  onPick,
  invalid,
}: Props) {
  const name = label === 'FROM' ? 'From account' : 'To account'
  if (locked) {
    return (
      <div
        aria-label={name}
        className={cn(CARD, 'border-fp-border bg-fp-surface-2')}
      >
        <Face label={label} wallet={null} locked />
        <Lock size={15} strokeWidth={2} className="flex-none text-fp-text-3" />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={wallet ? `${name}: ${wallet.name}` : name}
        aria-invalid={invalid || undefined}
        className={cn(
          CARD,
          'outline-none transition focus-visible:shadow-[0_0_0_3px_var(--fp-accent-soft)]',
          invalid
            ? 'border-fp-danger bg-fp-danger/10'
            : 'border-fp-border bg-fp-surface hover:border-fp-border-strong',
        )}
      >
        <Face label={label} wallet={wallet} locked={false} />
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className="flex-none text-fp-text-3"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        <DropdownMenuRadioGroup value={wallet?.id ?? ''} onValueChange={onPick}>
          {options.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id} className="gap-2">
              <span
                aria-hidden
                className="size-[8px] flex-none rounded-[2px]"
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
