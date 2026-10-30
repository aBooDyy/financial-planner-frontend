import { IconChip } from '#/components/icons/IconChip'
import { Select, SelectTrigger } from '#/components/ui/select'
import { useAccountSections } from '#/features/transactions/hooks/useAccountSections'
import type { PickedAccount } from '#/features/transactions/hooks/useAccountSections'
import { cn } from '#/lib/utils'
import { AccountSelectContent, NO_ACCOUNT } from './AccountSelectContent'
import type { AccountChoice } from './AccountSelectContent'

type Props = {
  id?: string
  label?: string
  describedBy?: string
  /** A wallet id or a `trailing` value; empty for none. */
  value: string | null
  /** The picked wallet id or `trailing` value; empty for `noneLabel`'s row. */
  onChange: (value: string) => void
  /** The wallets offered; every live one when left out. */
  wallets?: ReadonlyArray<{ id: string }>
  noneLabel?: string
  trailing?: ReadonlyArray<AccountChoice>
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
}

function AccountFace({ account }: { account: PickedAccount }) {
  return (
    <>
      <IconChip
        id={account.icon}
        color={account.color}
        size={22}
        iconSize={13}
        className="rounded-[6px]"
      />
      <span className="min-w-0 flex-1 truncate text-start">
        {account.archived ? `${account.name} (archived)` : account.name}
      </span>
    </>
  )
}

/** The form field that picks a wallet from the account tree. */
export function AccountSelect({
  id,
  label,
  describedBy,
  value,
  onChange,
  wallets,
  noneLabel,
  trailing = [],
  placeholder = 'Pick a wallet',
  invalid,
  disabled,
  className,
}: Props) {
  const { sections, amountsLoading, ready, accountById } =
    useAccountSections(wallets)
  const account = value ? accountById(value) : undefined
  const choice = trailing.find((c) => c.value === value)
  const nothingToPick =
    sections.length === 0 && !noneLabel && trailing.length === 0

  const text = choice
    ? choice.label
    : value
      ? ready
        ? 'Deleted account'
        : ''
      : (noneLabel ?? (nothingToPick ? 'No wallets yet' : placeholder))
  const muted = !value && !noneLabel

  return (
    <Select
      value={value || (noneLabel ? NO_ACCOUNT : undefined)}
      onValueChange={(v) => onChange(v === NO_ACCOUNT ? '' : v)}
      disabled={disabled || nothingToPick}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={className}
      >
        {account ? (
          <AccountFace account={account} />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-start',
              muted && 'font-medium text-fp-text-3',
            )}
          >
            {text}
          </span>
        )}
      </SelectTrigger>
      <AccountSelectContent
        sections={sections}
        amountsLoading={amountsLoading}
        noneLabel={noneLabel}
        trailing={trailing}
      />
    </Select>
  )
}
