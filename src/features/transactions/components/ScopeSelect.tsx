import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  scopeFromValue,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import type {
  Scope,
  ScopeSection,
} from '#/features/transactions/data/selectors'
import { AccountTreeGroups } from './AccountTreeGroups'

type Props = {
  sections: ScopeSection[]
  /** The option balances are still being summed. */
  balancesLoading: boolean
  value: Scope
  onChange: (scope: Scope) => void
}

/** The Spending page's account filter, laid out like the Wallets tree. */
export function ScopeSelect({
  sections,
  balancesLoading,
  value,
  onChange,
}: Props) {
  return (
    <Select
      value={scopeToValue(value)}
      onValueChange={(v) => onChange(scopeFromValue(v))}
    >
      <SelectTrigger
        title="Filter all tabs by account"
        className="w-auto min-w-[172px] max-w-[300px] py-[9px] text-[13px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-[260px]">
        <AccountTreeGroups
          sections={sections}
          groupsSelectable
          amountsLoading={balancesLoading}
        />
      </SelectContent>
    </Select>
  )
}
