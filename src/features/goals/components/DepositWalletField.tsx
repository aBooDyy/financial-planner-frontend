import type { LocalBalanceNode } from '#/db/types'
import { walletGroupOptions } from '#/features/wallets/data/selectors'
import { FieldLabel } from '#/components/FieldLabel'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { WalletDot } from './WalletDot'

const NONE = '__none__'

type Props = {
  value: string | null
  nodes: LocalBalanceNode[]
  onChange: (walletId: string | null) => void
}

/** Income: the wallet a payday lands in, so its planned payday confirms in one tap. */
export function DepositWalletField({ value, nodes, onChange }: Props) {
  const groups = walletGroupOptions(nodes)
  const known = groups.some((g) => g.wallets.some((w) => w.id === value))

  return (
    <div>
      <FieldLabel optional>Deposits into</FieldLabel>
      <Select
        value={value && known ? value : NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger aria-label="Deposits into">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Choose when it arrives</SelectItem>
          {groups.map((g, gi) => (
            <SelectGroup key={gi}>
              <SelectLabel>{g.label ?? 'Wallets'}</SelectLabel>
              {g.wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  <WalletDot color={w.color} />
                  {w.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
