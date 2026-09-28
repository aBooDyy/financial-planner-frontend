import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalBalanceNode } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { WalletSelectSections } from '#/features/wallets/components/WalletSelectSections'
import { sectionByGroup } from '#/features/wallets/data/walletSections'
import { useWalletGroups } from '#/features/wallets/hooks/useWalletGroups'

type Props = {
  id: string
  scope: 'category' | 'wallet'
  /** A wallet id, or a spend root's id. */
  value: string
  onChange: (id: string) => void
  wallets: ReadonlyArray<LocalBalanceNode>
  walletLabel: (w: LocalBalanceNode) => string
}

/** The one category or account a budget covers. */
export function BudgetTargetSelect({
  id,
  scope,
  value,
  onChange,
  wallets,
  walletLabel,
}: Props) {
  const catalog = useCategoryCatalog()
  const walletGroups = useWalletGroups()
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue
          placeholder={scope === 'wallet' ? 'No wallets yet' : 'Pick one'}
        />
      </SelectTrigger>
      <SelectContent>
        {scope === 'wallet' ? (
          <WalletSelectSections
            sections={sectionByGroup(walletGroups, wallets)}
            renderItem={(w) => (
              <SelectItem key={w.id} value={w.id}>
                <span
                  aria-hidden
                  className="size-[10px] flex-none rounded-[3px]"
                  style={{ background: w.color }}
                />
                {walletLabel(w)}
              </SelectItem>
            )}
          />
        ) : (
          catalog.byType('spend').map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <IconChip
                id={c.icon}
                color={c.color}
                size={24}
                iconSize={13}
                className="rounded-[7px]"
              />
              {c.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
