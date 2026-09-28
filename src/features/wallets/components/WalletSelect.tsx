import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import { walletSections } from '#/features/wallets/data/walletSections'
import { WalletSelectSections } from './WalletSelectSections'

const NONE = '__none__'

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
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        <WalletSelectSections
          sections={walletSections(walletGroups)}
          renderItem={(w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          )}
        />
      </SelectContent>
    </Select>
  )
}
