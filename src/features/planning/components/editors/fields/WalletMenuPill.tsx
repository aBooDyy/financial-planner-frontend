import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import { Dot } from '#/features/planning/components/kit/Spine'

const NONE = '__none__'

type Props = {
  /** "Paid from", "Paid into". */
  lead: string
  wallets: ReadonlyArray<PlanningWallet>
  value: string | null
  onChange: (walletId: string | null) => void
  /** Offers no wallet ("Decide when paying"). */
  noneLabel?: string
}

/** A pill under an amount naming its wallet ("Paid from Main bank ▾"); opens the list. */
export function WalletMenuPill({
  lead,
  wallets,
  value,
  onChange,
  noneLabel,
}: Props) {
  const picked = wallets.find((w) => w.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${lead}: ${picked?.name ?? noneLabel ?? 'Pick a wallet'}`}
          className="flex max-w-full items-center gap-[7px] rounded-full border border-fp-border bg-fp-surface px-3 py-[6px] text-[13px] font-semibold text-fp-text-2 transition hover:border-fp-border-strong"
        >
          {picked ? <Dot color={picked.color} /> : null}
          <span className="truncate">
            {lead}{' '}
            <span className="font-bold text-fp-text">
              {picked?.name ?? noneLabel ?? 'Pick a wallet'}
            </span>
          </span>
          <ChevronDown size={14} className="flex-none" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[200px]">
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
          {noneLabel ? (
            <DropdownMenuRadioItem value={NONE}>
              {noneLabel}
            </DropdownMenuRadioItem>
          ) : null}
          {wallets.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id}>
              <Dot color={w.color} />
              {w.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
