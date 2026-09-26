import { DateField } from '#/components/DateField'
import {
  addDays,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import type { DateFormat } from '#/lib/date'
import { cn } from '#/lib/utils'
import { TxChip } from './TxChip'

type Props = {
  value: string
  onChange: (iso: string) => void
  dateFormat: DateFormat
}

/** Today and Yesterday one tap away, any other day through the date pill. */
export function TxDateChips({ value, onChange, dateFormat }: Props) {
  const today = startOfToday()
  const quick = [
    { label: 'Today', iso: ymd(today) },
    { label: 'Yesterday', iso: ymd(addDays(today, -1)) },
  ]
  const custom = !quick.some((q) => q.iso === value)

  return (
    <div className="flex flex-wrap gap-2">
      {quick.map((q) => (
        <TxChip
          key={q.label}
          active={q.iso === value}
          onClick={() => onChange(q.iso)}
        >
          {q.label}
        </TxChip>
      ))}
      <DateField
        value={value}
        onChange={(iso) => {
          if (iso) onChange(iso)
        }}
        dateFormat={dateFormat}
        ariaLabel="Date"
        iconSize={14}
        boxClassName={cn(
          'rounded-full border-[1.5px] px-3 py-[6px] text-[13.5px] font-bold',
          custom
            ? 'border-(--tx-ink)! bg-[color-mix(in_srgb,var(--tx-ink)_12%,var(--fp-surface))]!'
            : 'border-fp-border! bg-fp-surface!',
        )}
      />
    </div>
  )
}
