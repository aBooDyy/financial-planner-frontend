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
import { AccountSelect } from './AccountSelect'

type Props = {
  id: string
  scope: 'category' | 'wallet'
  /** A wallet id, or a spend root's id. */
  value: string
  onChange: (id: string) => void
  wallets: ReadonlyArray<LocalBalanceNode>
}

function BudgetCategorySelect({
  id,
  value,
  onChange,
}: Pick<Props, 'id' | 'value' | 'onChange'>) {
  const catalog = useCategoryCatalog()
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        {catalog.byType('spend').map((c) => (
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
        ))}
      </SelectContent>
    </Select>
  )
}

/** The one category or account a budget covers. */
export function BudgetTargetSelect({
  id,
  scope,
  value,
  onChange,
  wallets,
}: Props) {
  return scope === 'wallet' ? (
    <AccountSelect id={id} value={value} onChange={onChange} wallets={wallets} />
  ) : (
    <BudgetCategorySelect id={id} value={value} onChange={onChange} />
  )
}
