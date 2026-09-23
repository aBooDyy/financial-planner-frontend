import type { IncomeRow as IncomeRowData } from '#/features/goals/data/selectors'
import { ListRow } from './ListRow'

type Props = {
  row: IncomeRowData
  selected: boolean
  onSelect: (id: string) => void
}

export function IncomeRow({ row, selected, onSelect }: Props) {
  return (
    <ListRow
      color={row.color}
      selected={selected}
      onSelect={() => onSelect(row.id)}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">
          {row.label}
        </span>
        <span className="block truncate text-[11px] text-fp-text-3">
          {row.subStr} · {row.payStr}
        </span>
      </span>
      <span className="flex-none text-[13px] font-bold whitespace-nowrap tabular-nums">
        {row.monthlyStr}
        <span className="text-[11px] font-semibold text-fp-text-3">/mo</span>
      </span>
    </ListRow>
  )
}
