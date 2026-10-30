import { AccountSelect } from '#/features/transactions/components/AccountSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'

type Props = {
  id?: string
  value: string | null
  onChange: (walletId: string | null) => void
  walletGroups: WalletGroupOption[]
  invalid?: boolean
  disabled?: boolean
  /** What choosing no account reads as in this form. */
  noneLabel?: string
}

export function WalletSelect({
  id,
  value,
  onChange,
  walletGroups,
  invalid,
  disabled,
  noneLabel = 'No default account',
}: Props) {
  return (
    <AccountSelect
      id={id}
      value={value}
      onChange={(walletId) => onChange(walletId || null)}
      wallets={walletGroups.flatMap((g) => g.wallets)}
      noneLabel={noneLabel}
      invalid={invalid}
      disabled={disabled}
      className="w-full"
    />
  )
}
