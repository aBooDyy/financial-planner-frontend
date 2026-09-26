import { TargetPicker } from './TargetPicker'
import type { TargetGroup } from '#/features/import/data/values'

type Props = {
  id: string
  /** The chosen wallet id, or '' for none. */
  value: string
  onChange: (walletId: string) => void
  wallets: ReadonlyArray<TargetGroup>
  /** A wallet that may not be picked here — a transfer's own account, for its other side. */
  exclude?: string
}

const NO_WALLET = '__none__'

const LEADING = [{ value: NO_WALLET, label: 'No account' }]

/** One of the user's accounts, or none — the row editor's account pickers. */
export function WalletSelect({ id, value, onChange, wallets, exclude }: Props) {
  return (
    <TargetPicker
      id={id}
      value={value === '' ? NO_WALLET : value}
      invalid={value === ''}
      placeholder="Pick an account"
      searchPlaceholder="Search accounts…"
      groups={wallets}
      leading={LEADING}
      exclude={exclude}
      onChange={(next) => onChange(next === NO_WALLET ? '' : next)}
    />
  )
}
