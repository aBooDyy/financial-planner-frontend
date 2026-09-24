import type { LocalBalanceNode } from '#/db/types'
import { walletGroupOptions } from '#/features/balances/data/selectors'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { FIELD_LABEL } from './styles'

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
      <Label className={FIELD_LABEL}>Deposits into</Label>
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
