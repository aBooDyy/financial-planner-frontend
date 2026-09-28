import { cn } from '#/lib/utils'
import type { WalletOption } from '#/features/search/data/filterOptions'
import { FilterSection } from './FilterSection'
import { SearchChip } from './SearchChip'

type Props = {
  wallets: ReadonlyArray<WalletOption>
  picked: ReadonlyArray<string>
  onToggle: (walletId: string) => void
}

export function AccountFilter({ wallets, picked, onToggle }: Props) {
  return (
    <FilterSection label="Accounts">
      <div className="flex flex-wrap gap-[6px]">
        {wallets.map((w) => {
          const on = picked.includes(w.id)
          return (
            <SearchChip key={w.id} active={on} onClick={() => onToggle(w.id)}>
              <span
                aria-hidden
                className="size-2 flex-none rounded-full"
                style={{ background: w.color }}
              />
              <span className="truncate">{w.name}</span>
              <span
                className={cn(
                  'rounded-[5px] px-[6px] py-px text-[10.5px] font-bold tracking-[0.02em] whitespace-nowrap text-fp-text-3',
                  on ? 'bg-fp-surface' : 'bg-fp-surface-2',
                )}
              >
                {w.groupName ?? 'Account'}
              </span>
            </SearchChip>
          )
        })}
      </div>
    </FilterSection>
  )
}
