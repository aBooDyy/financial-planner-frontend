import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { WalletGroupOption } from '#/features/balances/data/selectors'

const NONE = '__none__'

type Props = {
  id?: string
  value: string | null
  onChange: (walletId: string | null) => void
  walletGroups: WalletGroupOption[]
  invalid?: boolean
  disabled?: boolean
}

export function WalletSelect({
  id,
  value,
  onChange,
  walletGroups,
  invalid,
  disabled,
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
        <SelectItem value={NONE}>No default account</SelectItem>
        {walletGroups.map((g, i) =>
          g.label === null ? (
            g.wallets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))
          ) : (
            <SelectGroup key={`${g.label}-${i}`}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ),
        )}
      </SelectContent>
    </Select>
  )
}
