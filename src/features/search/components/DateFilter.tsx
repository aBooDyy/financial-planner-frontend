import { DateField } from '#/components/DateField'
import type { DateFormat } from '#/lib/date'
import type {
  SearchDateFilter,
  SearchFilters,
} from '#/features/search/data/types'
import { FilterSection } from './FilterSection'
import { SearchChip } from './SearchChip'

const OPTIONS: ReadonlyArray<{ value: SearchDateFilter; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom' },
]

const BOX =
  'h-[38px] w-full rounded-[10px] bg-fp-surface px-[10px] text-[13.5px] font-semibold'

type Props = {
  filters: SearchFilters
  dateFormat: DateFormat
  onChange: (patch: Partial<SearchFilters>) => void
}

export function DateFilter({ filters, dateFormat, onChange }: Props) {
  return (
    <FilterSection label="Date">
      <div className="flex flex-wrap gap-[6px]">
        {OPTIONS.map((o) => (
          <SearchChip
            key={o.value}
            active={filters.date === o.value}
            onClick={() => onChange({ date: o.value })}
          >
            {o.label}
          </SearchChip>
        ))}
      </div>
      {filters.date === 'custom' ? (
        <div className="flex max-w-[360px] items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[11px] font-semibold text-fp-text-3">
              From
            </span>
            <DateField
              value={filters.from}
              onChange={(from) => onChange({ from })}
              dateFormat={dateFormat}
              ariaLabel="From"
              placeholder="Any"
              boxClassName={BOX}
              iconSize={14}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[11px] font-semibold text-fp-text-3">To</span>
            <DateField
              value={filters.to}
              onChange={(to) => onChange({ to })}
              dateFormat={dateFormat}
              ariaLabel="To"
              placeholder="Now"
              boxClassName={BOX}
              iconSize={14}
            />
          </label>
        </div>
      ) : null}
    </FilterSection>
  )
}
