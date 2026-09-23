import { AlertTriangle, ArrowRight } from 'lucide-react'
import { memo, useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Badge } from '#/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  CREATE,
  NEW,
  SKIP,
  UNSET,
  preferredFirst,
} from '#/features/import/data/values'
import type { TargetGroup, ValueRow } from '#/features/import/data/values'
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

type OptionsProps = {
  options: ReadonlyArray<TargetGroup>
  preferGroup: string | null
  newLabel: string | null
  createLabel: string | null
  skipLabel: string | null
}

/**
 * Every target this value could mean. Rendered only while the menu is open: a screen of
 * seventy values against a catalogue of hundreds is thousands of elements built and thrown
 * away on each answer, and Radix evaluates these children whether or not it mounts them.
 */
function TargetOptions({
  options,
  preferGroup,
  newLabel,
  createLabel,
  skipLabel,
}: OptionsProps) {
  return (
    <>
      <SelectItem value={UNSET}>{NEEDS_MATCH}</SelectItem>
      {newLabel ? <SelectItem value={NEW}>{newLabel}</SelectItem> : null}
      {preferredFirst(options, preferGroup).map((group, index) => (
        <SelectGroup key={group.label ?? `group-${index}`}>
          {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
          {group.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
      {createLabel ? (
        <SelectItem value={CREATE}>{createLabel}</SelectItem>
      ) : null}
      {skipLabel ? <SelectItem value={SKIP}>{skipLabel}</SelectItem> : null}
    </>
  )
}

/**
 * Radix reads a closed trigger's text off a mounted item, so the chosen one stays mounted
 * while the rest of the list does not.
 */
const chosenLabel = (
  row: ValueRow,
  options: ReadonlyArray<TargetGroup>,
  skipLabel: string | null,
): string => {
  if (row.value === NEW) return row.newLabel ?? NEEDS_MATCH
  if (row.value === SKIP) return skipLabel ?? NEEDS_MATCH
  for (const group of options) {
    const option = group.options.find((entry) => entry.value === row.value)
    if (option) return option.label
  }
  return NEEDS_MATCH
}

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
  const [open, setOpen] = useState(false)
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
          <Select
            value={row.value}
            disabled={row.blank}
            open={open}
            onOpenChange={setOpen}
            onValueChange={choose}
          >
            <SelectTrigger aria-label={label} className="min-w-0 flex-1">
              <SelectValue placeholder={NEEDS_MATCH} />
            </SelectTrigger>
            <SelectContent>
              {open ? (
                <TargetOptions
                  options={options}
                  preferGroup={row.preferGroup}
                  newLabel={row.newLabel}
                  createLabel={createLabel}
                  skipLabel={skipLabel}
                />
              ) : (
                <SelectItem value={row.value}>
                  {chosenLabel(row, options, skipLabel)}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
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
