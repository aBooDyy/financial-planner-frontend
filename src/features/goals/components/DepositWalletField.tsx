import type { LocalBalanceNode } from '#/db/types'
import { walletGroupOptions } from '#/features/wallets/data/selectors'
import { walletSections } from '#/features/wallets/data/walletSections'
import { WalletSelectSections } from '#/features/wallets/components/WalletSelectSections'
import { FieldLabel } from '#/components/FieldLabel'
import {
  Select,
  SelectContent,
  SelectItem,
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
          <WalletSelectSections
            sections={walletSections(groups)}
            renderItem={(w) => (
              <SelectItem key={w.id} value={w.id}>
                <WalletDot color={w.color} />
                {w.name}
              </SelectItem>
            )}
          />
        </SelectContent>
      </Select>
    </div>
  )
}
