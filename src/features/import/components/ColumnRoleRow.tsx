import { Badge } from '#/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { ColumnRole } from '#/features/import/data/types'

/** Our words for the file's columns — money out / money in, never debit / credit. */
export const ROLE_LABELS: Readonly<Record<ColumnRole, string>> = {
  skip: 'Skip this column',
  date: 'Date',
  amount: 'Amount',
  amountOut: 'Money out',
  amountIn: 'Money in',
  type: 'Money in or out',
  currency: 'Currency',
  wallet: 'Account',
  category: 'Category',
  subcategory: 'Subcategory',
  merchant: 'Merchant',
  note: 'Note',
  reference: 'Reference',
}

type Props = {
  column: number
  header: string
  samples: ReadonlyArray<string>
  role: ColumnRole
  options: ReadonlyArray<ColumnRole>
  auto: boolean
  onChange: (role: ColumnRole) => void
}

export const GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(110px,0.9fr)_minmax(0,1.3fr)_minmax(190px,0.8fr)] md:items-center md:gap-4'

/** One column of the file: what it is called, what is in it, and what it holds. */
export function ColumnRoleRow({
  column,
  header,
  samples,
  role,
  options,
  auto,
  onChange,
}: Props) {
  const name = header.trim() === '' ? `Column ${column + 1}` : header
  const samplesId = `column-${column}-samples`

  return (
    <div
      role="row"
      aria-rowindex={column + 2}
      className={`${GRID} border-b border-fp-border px-[14px] py-3 last:border-0`}
    >
      <div role="cell" className="min-w-0 text-[13.5px] font-bold break-words">
        {name}
      </div>

      <div role="cell" id={samplesId} className="flex flex-wrap gap-1.5">
        {samples.map((value, index) => (
          <span
            key={index}
            className="max-w-full truncate rounded-md bg-fp-surface-2 px-2 py-[3px] text-[12px] text-fp-text-2"
          >
            {value.trim() === '' ? '—' : value}
          </span>
        ))}
      </div>

      <div role="cell" className="flex items-center gap-2">
        <Select
          value={role}
          onValueChange={(next) => onChange(next as ColumnRole)}
        >
          {/* The evidence is described, not just shown: choosing a role without the sample
              values is guesswork. */}
          <SelectTrigger
            aria-label={`What ${name} holds`}
            aria-describedby={samplesId}
            className="min-w-0 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {ROLE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {auto ? (
          <Badge className="shrink-0 gap-1 bg-fp-accent-soft px-2 py-[4px] text-[11px] font-semibold text-fp-accent-ink">
            ✓ auto
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
