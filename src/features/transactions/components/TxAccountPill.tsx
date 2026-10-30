import { IconChip } from '#/components/icons/IconChip'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { Select, SelectTrigger } from '#/components/ui/select'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import { AccountSelectContent, NO_ACCOUNT } from './AccountSelectContent'

type Props = {
  /** "Paid from" / "Paid into". */
  label: string
  /** The accounts as the Wallets tree groups them (`entryAccountSections`). */
  sections: ReadonlyArray<ScopeSection>
  chosen: Pick<TransferWallet, 'id' | 'name' | 'color' | 'icon'> | null
  archived: boolean
  /** The picked wallet id; empty for `noneLabel`'s row. */
  onChange: (walletId: string) => void
  invalid: boolean
  amountsLoading?: boolean
  /** Offers no wallet ("Decide when paying"). */
  noneLabel?: string
  placeholder?: string
}

/** The account select's trigger, worn as a pill under an amount well. */
const ACCOUNT_PILL =
  'w-max max-w-full gap-[7px] rounded-full border-fp-border bg-fp-surface py-[5px] ps-[6px] pe-3 text-[13px] font-bold disabled:opacity-100'

/** The account under the amount; it also decides the amount's currency. */
export function TxAccountPill({
  label,
  sections,
  chosen,
  archived,
  onChange,
  invalid,
  amountsLoading,
  noneLabel,
  placeholder = 'Pick a wallet',
}: Props) {
  const empty = sections.length === 0
  const nothing = noneLabel ?? (empty ? 'No wallets yet' : placeholder)
  return (
    <Select
      value={chosen ? chosen.id : noneLabel ? NO_ACCOUNT : undefined}
      onValueChange={(v) => onChange(v === NO_ACCOUNT ? '' : v)}
      disabled={empty && !noneLabel}
    >
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={ACCOUNT_PILL}
      >
        {chosen ? (
          <IconChip
            id={chosen.icon}
            color={chosen.color}
            size={22}
            iconSize={13}
            className="rounded-full"
          />
        ) : (
          <span
            aria-hidden
            className="size-[22px] flex-none rounded-full bg-fp-surface-2"
          />
        )}
        <span className="flex-none font-semibold whitespace-nowrap text-fp-text-3">
          {label}
        </span>
        <span className="max-w-[200px] truncate">
          {chosen
            ? archived
              ? `${chosen.name} (archived)`
              : chosen.name
            : nothing}
        </span>
      </SelectTrigger>
      <AccountSelectContent
        sections={sections}
        amountsLoading={amountsLoading}
        noneLabel={noneLabel}
      />
    </Select>
  )
}
