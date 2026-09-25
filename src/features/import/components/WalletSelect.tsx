import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
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

/** One of the user's accounts, or none — the row editor's account pickers. */
export function WalletSelect({ id, value, onChange, wallets, exclude }: Props) {
  return (
    <Select
      value={value === '' ? NO_WALLET : value}
      onValueChange={(next) => onChange(next === NO_WALLET ? '' : next)}
    >
      <SelectTrigger id={id} aria-invalid={value === ''}>
        <SelectValue placeholder="Pick an account" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_WALLET}>No account</SelectItem>
        {wallets.map((group, index) => (
          <SelectGroup key={group.label ?? `wallets-${index}`}>
            {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
            {group.options
              .filter((option) => option.value !== exclude)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
