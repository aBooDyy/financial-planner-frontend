import type { LocalBalanceNode } from '#/db/types'
import { EXTERNAL } from '#/features/planned/hooks/useConfirmForm'
import { AccountSelect } from '#/features/transactions/components/AccountSelect'

type Props = {
  id: string
  label: string
  wallets: ReadonlyArray<LocalBalanceNode>
  value: string
  /** Offers "External…" — money held outside any wallet (set-asides only). */
  allowExternal: boolean
  onChange: (source: string) => void
}

const EXTERNAL_CHOICE = [{ value: EXTERNAL, label: 'External…' }]

/** Where a confirmed item's money came from or went: a wallet, or somewhere external. */
export function ConfirmWalletSelect({
  id,
  label,
  wallets,
  value,
  allowExternal,
  onChange,
}: Props) {
  return (
    <AccountSelect
      id={id}
      label={label}
      wallets={wallets}
      value={value}
      trailing={allowExternal ? EXTERNAL_CHOICE : undefined}
      onChange={onChange}
    />
  )
}
