import { cn } from '#/lib/utils'
import type { SearchTypeFilter } from '#/features/search/data/types'
import { FilterSection } from './FilterSection'

const OPTIONS: ReadonlyArray<{ value: SearchTypeFilter; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'spend', label: 'Spending' },
  { value: 'income', label: 'Income' },
]

type Props = {
  value: SearchTypeFilter
  onChange: (value: SearchTypeFilter) => void
}

export function TypeFilter({ value, onChange }: Props) {
  return (
    <FilterSection label="Type">
      <div
        role="radiogroup"
        aria-label="Type"
        className="flex max-w-[340px] gap-[2px] rounded-[10px] bg-fp-border p-[3px]"
      >
        {OPTIONS.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex-1 rounded-[8px] px-[10px] py-[7px] text-[12.5px] whitespace-nowrap',
                active
                  ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'font-semibold text-fp-text-2 hover:text-fp-text',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </FilterSection>
  )
}
