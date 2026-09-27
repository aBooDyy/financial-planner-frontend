import { ChevronDownIcon, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  ancestorValues,
  scopeLabel,
} from '#/features/transactions/data/scopePicker'
import type {
  Scope,
  ScopeSection,
} from '#/features/transactions/data/selectors'
import { cn } from '#/lib/utils'
import { ScopeMenuTree } from './ScopeMenuTree'

type Props = {
  sections: ScopeSection[]
  /** The option balances are still being summed. */
  balancesLoading: boolean
  value: Scope
  onChange: (scope: Scope) => void
  /** The narrow pill of the mobile sub-nav: no icon, "All" or "2 accounts" for several. */
  compact?: boolean
}

/**
 * The Spending page's account filter: everything, or any mix of wallets and groups. The
 * trigger is a plain label; the balances live in the menu and on the cashflow card.
 */
export function ScopeSelect({
  sections,
  balancesLoading,
  value,
  onChange,
  compact = false,
}: Props) {
  const ancestors = useMemo(() => ancestorValues(sections), [sections])
  const label = !compact
    ? scopeLabel(value, sections)
    : value.type === 'all'
      ? 'All'
      : value.type === 'accounts'
        ? `${value.picks.length} accounts`
        : scopeLabel(value, sections)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Filter all tabs by account"
        className={cn(
          'inline-flex max-w-full min-w-0 cursor-pointer items-center gap-[7px] rounded-[10px] border border-fp-border bg-fp-surface-2 text-fp-text outline-none focus-visible:border-fp-accent',
          compact
            ? 'py-[5px] ps-[9px] pe-[7px]'
            : 'max-w-[260px] py-[7px] ps-[10px] pe-[9px]',
        )}
      >
        {compact ? null : (
          <Wallet
            size={15}
            strokeWidth={1.8}
            className="flex-none text-fp-text-2"
          />
        )}
        <span className="truncate text-[13px] font-bold">{label}</span>
        <ChevronDownIcon className="size-[14px] flex-none text-fp-text-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px]">
        <ScopeMenuTree
          sections={sections}
          ancestors={ancestors}
          value={value}
          amountsLoading={balancesLoading}
          onChange={onChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
