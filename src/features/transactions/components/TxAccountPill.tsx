import { IconChip } from '#/components/icons/IconChip'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { Select, SelectContent, SelectTrigger } from '#/components/ui/select'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import { AccountTreeGroups } from './AccountTreeGroups'

type Props = {
  /** "Paid from" / "Paid into". */
  label: string
  /** The accounts as the Wallets tree groups them (`entryAccountSections`). */
  sections: ReadonlyArray<ScopeSection>
  chosen: TransferWallet | null
  archived: boolean
  onChange: (walletId: string) => void
  invalid: boolean
}

const WALLET = 'wallet:'

/** The account select's trigger, worn as a pill under an amount well. */
export const ACCOUNT_PILL =
  'w-max max-w-full gap-[7px] rounded-full border-fp-border bg-fp-surface py-[5px] ps-[6px] pe-3 text-[13px] font-bold disabled:opacity-100'

/** The account under the amount; it also decides the amount's currency. */
export function TxAccountPill({
  label,
  sections,
  chosen,
  archived,
  onChange,
  invalid,
}: Props) {
  return (
    <Select
      value={chosen ? `${WALLET}${chosen.id}` : undefined}
      onValueChange={(v) => {
        if (v.startsWith(WALLET)) onChange(v.slice(WALLET.length))
      }}
      disabled={sections.length === 0}
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
            : 'No wallets yet'}
        </span>
      </SelectTrigger>
      <SelectContent className="min-w-[260px]">
        <AccountTreeGroups sections={sections} groupsSelectable={false} />
      </SelectContent>
    </Select>
  )
}
