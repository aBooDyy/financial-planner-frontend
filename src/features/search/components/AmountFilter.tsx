import { AmountBoundField } from './AmountBoundField'
import { FilterSection } from './FilterSection'

type Props = {
  min: string
  max: string
  /** The base currency's symbol: amounts compare in base. */
  symbol: string
  onChange: (patch: { min?: string; max?: string }) => void
}

export function AmountFilter({ min, max, symbol, onChange }: Props) {
  return (
    <FilterSection label="Amount">
      <div className="flex max-w-[340px] items-center gap-2">
        <AmountBoundField
          value={min}
          symbol={symbol}
          placeholder="Min"
          label="Minimum amount"
          onValue={(v) => onChange({ min: v })}
        />
        <span aria-hidden className="text-fp-text-3">
          –
        </span>
        <AmountBoundField
          value={max}
          symbol={symbol}
          placeholder="Max"
          label="Maximum amount"
          onValue={(v) => onChange({ max: v })}
        />
      </div>
    </FilterSection>
  )
}
