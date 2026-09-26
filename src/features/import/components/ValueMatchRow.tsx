import { AlertTriangle, ArrowRight } from 'lucide-react'
import { memo } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Badge } from '#/components/ui/badge'
import {
  CREATE,
  NEW,
  SKIP,
  UNSET,
  preferredFirst,
} from '#/features/import/data/values'
import { TargetPicker } from './TargetPicker'
import type {
  TargetGroup,
  TargetOption,
  ValueRow,
} from '#/features/import/data/values'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  row: ValueRow
  options: ReadonlyArray<TargetGroup>
  /** Label for the inline-create option, or null where creating makes no sense. */
  createLabel: string | null
  skipLabel: string | null
  baseCurrency: CurrencyCode
  /** What a blank cell falls back to, from step ②. */
  defaultLabel: string | null
  onChange: (key: string, value: string) => void
  onCreate: (key: string, raw: string) => void
}

export const VALUE_GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(200px,0.9fr)_minmax(92px,auto)] md:items-center md:gap-3'

/** One formatter for the whole screen: `new Intl.NumberFormat()` costs more than it reads. */
const ROW_COUNT = new Intl.NumberFormat()

const NEEDS_MATCH = 'Needs a match'

const rowsLabel = (count: number): string =>
  `${ROW_COUNT.format(count)} ${count === 1 ? 'row' : 'rows'}`

function MatchBadge({ row }: { row: ValueRow }) {
  if (row.blank) {
    return (
      <Badge
        variant="outline"
        className="gap-1 px-2 py-[4px] text-[11px] font-semibold text-fp-text-3"
      >
        default
      </Badge>
    )
  }
  if (!row.matched) {
    return row.ambiguous ? (
      <Badge
        variant="outline"
        className="gap-1 px-2 py-[4px] text-[11px] font-semibold text-fp-text-2"
      >
        <AlertTriangle size={11} strokeWidth={2.2} aria-hidden />
        Choose one
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="gap-1 border-fp-danger/40 px-2 py-[4px] text-[11px] font-semibold text-fp-danger"
      >
        <AlertTriangle size={11} strokeWidth={2.2} aria-hidden />
        {NEEDS_MATCH}
      </Badge>
    )
  }
  if (row.proposed && row.tier === 'auto') {
    return (
      <Badge className="gap-1 bg-fp-accent-soft px-2 py-[4px] text-[11px] font-semibold text-fp-accent-ink">
        ✓ auto
      </Badge>
    )
  }
  if (row.proposed && row.tier === 'check') {
    return (
      <Badge
        variant="outline"
        className="gap-1 px-2 py-[4px] text-[11px] font-semibold text-fp-text-2"
      >
        <AlertTriangle size={11} strokeWidth={2.2} aria-hidden />
        Check this
      </Badge>
    )
  }
  return null
}

const SEARCH: Readonly<Record<ValueRow['kind'], string>> = {
  wallet: 'Search accounts…',
  category: 'Search categories…',
  merchant: 'Search merchants…',
  type: 'Search…',
  currency: 'Search…',
}

/** The answers above the catalogue: none yet, or the one this import will create. */
const leadingFor = (row: ValueRow): TargetOption[] => [
  { value: UNSET, label: NEEDS_MATCH },
  ...(row.newLabel ? [{ value: NEW, label: row.newLabel }] : []),
]

const trailingFor = (
  createLabel: string | null,
  skipLabel: string | null,
): TargetOption[] => [
  ...(createLabel ? [{ value: CREATE, label: createLabel }] : []),
  ...(skipLabel ? [{ value: SKIP, label: skipLabel }] : []),
]

/** One distinct value from the file, and what it means here. */
function ValueMatchRowInner({
  row,
  options,
  createLabel,
  skipLabel,
  baseCurrency,
  defaultLabel,
  onChange,
  onCreate,
}: Props) {
  const name = row.blank ? '(blank)' : row.raw
  const label = `What “${name}” means`

  const choose = (value: string) => {
    if (value === CREATE) onCreate(row.key, row.raw)
    else if (value !== NEW) onChange(row.key, value)
  }

  return (
    <div
      className={`${VALUE_GRID} border-b border-fp-border px-[14px] py-3 last:border-0`}
    >
      <div className="flex min-w-0 flex-col gap-[3px]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px]">
          <span
            className={`min-w-0 text-[13.5px] font-bold break-words ${
              row.blank ? 'text-fp-text-3 italic' : ''
            }`}
          >
            {name}
          </span>
          <span className="shrink-0 text-[12px] text-fp-text-3 tabular-nums">
            {rowsLabel(row.count)}
          </span>
        </div>
        {row.hint ? (
          <span className="text-[12px] text-fp-text-3">{row.hint}</span>
        ) : null}
        {row.blank && defaultLabel ? (
          <span className="text-[12px] text-fp-text-3">
            Falls back to {defaultLabel}.
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <ArrowRight
          size={14}
          strokeWidth={2}
          aria-hidden
          className="hidden shrink-0 text-fp-text-3 md:block rtl:-scale-x-100"
        />
        {row.kind === 'currency' ? (
          <CurrencyPicker
            value={row.value === UNSET ? baseCurrency : row.value}
            base={baseCurrency}
            label={label}
            onChange={(code) => onChange(row.key, code)}
            className="min-w-0 flex-1"
          />
        ) : (
          <TargetPicker
            value={row.value}
            disabled={row.blank}
            ariaLabel={label}
            placeholder={NEEDS_MATCH}
            searchPlaceholder={SEARCH[row.kind]}
            groups={preferredFirst(options, row.preferGroup)}
            leading={leadingFor(row)}
            trailing={trailingFor(createLabel, skipLabel)}
            onChange={choose}
            className="min-w-0 flex-1"
          />
        )}
      </div>

      <div className="flex items-center md:justify-end">
        <MatchBadge row={row} />
      </div>
    </div>
  )
}

/** `valueRows` rebuilds every row object on each answer, so the fields decide, not identity. */
const sameRow = (a: ValueRow, b: ValueRow): boolean =>
  (Object.keys(a) as Array<keyof ValueRow>).every(
    (field) => a[field] === b[field],
  )

const samePropsAs = (a: Props, b: Props): boolean =>
  sameRow(a.row, b.row) &&
  a.options === b.options &&
  a.createLabel === b.createLabel &&
  a.skipLabel === b.skipLabel &&
  a.baseCurrency === b.baseCurrency &&
  a.defaultLabel === b.defaultLabel &&
  a.onChange === b.onChange &&
  a.onCreate === b.onCreate

/**
 * Memoised on purpose: answering one value rebuilds its group's rows, and without this every
 * other row on screen would re-render — with its whole target list underneath it.
 */
export const ValueMatchRow = memo(ValueMatchRowInner, samePropsAs)
