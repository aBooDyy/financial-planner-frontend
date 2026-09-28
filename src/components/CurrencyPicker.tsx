import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  commandFilter,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { useCurrencyList } from '#/lib/config/appConfig'
import type { CurrencyMeta } from '#/lib/config/appConfig'
import { currencySymbol } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { cn } from '#/lib/utils'
import { FIELD_WELL } from '#/components/ui/field-well'

type Props = {
  value: CurrencyCode
  onChange: (code: CurrencyCode) => void
  /** The user's base currency, offered at the top alongside their recent picks. */
  base?: CurrencyCode
  label?: string
  disabled?: boolean
  /** Extra classes for the trigger button. */
  className?: string
  /** Hide the user's own currencies. The base is what every rate is quoted against, so it
   *  can't be one the user defined and priced themselves. */
  isoOnly?: boolean
  align?: 'start' | 'center' | 'end'
  /** `pill`: a compact "Currency SAR ▾" chip, e.g. under an amount well or at a well's end. */
  appearance?: 'well' | 'pill'
  /** A quiet word before the code ("Currency"); a pill drops the symbol after it. */
  prefix?: string
}

const TRIGGER = {
  well: cn(
    FIELD_WELL,
    'flex h-auto w-full cursor-pointer items-center justify-between gap-2 whitespace-nowrap',
  ),
  pill: 'flex w-max max-w-full cursor-pointer items-center gap-[6px] rounded-full border border-fp-border bg-fp-surface px-3 py-[6px] text-[13px] whitespace-nowrap text-fp-text transition outline-none hover:border-fp-border-strong focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15 disabled:cursor-not-allowed disabled:opacity-50',
}

/** What cmdk matches and sorts on — code first, so "usd" beats a name that merely contains it. */
const optionValue = (c: CurrencyMeta) => `${c.code} ${c.name}`

const suggestedFor = (
  currencies: CurrencyMeta[],
  base: CurrencyCode | undefined,
  value: CurrencyCode,
  recent: string[],
): CurrencyMeta[] => {
  const byCode = new Map(currencies.map((c) => [c.code, c]))
  return [...new Set([base, value, ...recent])]
    .map((code) => (code === undefined ? undefined : byCode.get(code)))
    .filter((c): c is CurrencyMeta => c !== undefined)
}

/**
 * Matching and ranking run here instead of inside cmdk (`shouldFilter={false}`) so that only
 * the hits are ever mounted; cmdk's own scorer keeps the results identical to its default.
 */
const matchesFor = (
  currencies: CurrencyMeta[],
  query: string,
): CurrencyMeta[] => {
  const search = query.trim()
  if (search === '') return currencies
  return currencies
    .map((c) => ({ c, score: commandFilter(optionValue(c), search) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.c)
}

type RowProps = {
  currency: CurrencyMeta
  selected: boolean
  onPick: (code: string) => void
}

const CurrencyRow = memo(function CurrencyRow({
  currency,
  selected,
  onPick,
}: RowProps) {
  return (
    <CommandItem
      value={optionValue(currency)}
      onSelect={() => onPick(currency.code)}
      className={
        selected
          ? 'bg-fp-accent-soft data-[selected=true]:bg-fp-accent-soft'
          : undefined
      }
    >
      <span className="w-[34px] shrink-0 text-[12.5px] font-bold text-fp-text-2 tabular-nums">
        {currency.symbol}
      </span>
      <span className="min-w-0 flex-1 truncate">{currency.name}</span>
      <span className="shrink-0 text-[12px] font-semibold text-fp-text-3">
        {currency.code}
      </span>
      {selected ? (
        <Check size={14} className="shrink-0 text-fp-accent-ink" />
      ) : null}
    </CommandItem>
  )
})

type GroupProps = {
  heading: string
  items: CurrencyMeta[]
  value: CurrencyCode
  onPick: (code: string) => void
  keyPrefix: string
}

/** Memoised so a keystroke re-renders the input, not every row under it. */
const CurrencyGroup = memo(function CurrencyGroup({
  heading,
  items,
  value,
  onPick,
  keyPrefix,
}: GroupProps) {
  // A heading with nothing under it is what cmdk hides for us when it does the filtering.
  if (items.length === 0) return null
  return (
    <CommandGroup heading={heading}>
      {items.map((c) => (
        <CurrencyRow
          key={`${keyPrefix}-${c.code}`}
          currency={c}
          selected={c.code === value}
          onPick={onPick}
        />
      ))}
    </CommandGroup>
  )
})

type ListProps = {
  currencies: CurrencyMeta[]
  suggested: CurrencyMeta[]
  value: CurrencyCode
  onPick: (code: string) => void
}

function CurrencyOptions({ currencies, suggested, value, onPick }: ListProps) {
  const [query, setQuery] = useState('')
  // A keystroke must paint before the table is re-filtered, so the list lags the input by one
  // background render — and the table itself only arrives after the panel is on screen.
  const deferredQuery = useDeferredValue(query)
  const ready = useDeferredValue(true, false)
  const matches = useMemo(
    () => (ready ? matchesFor(currencies, deferredQuery) : []),
    [ready, currencies, deferredQuery],
  )
  const searching = query.trim() !== ''
  const best =
    !searching && suggested.length > 0
      ? optionValue(suggested[0])
      : matches.length > 0
        ? optionValue(matches[0])
        : ''

  // cmdk highlights the best match itself only while it owns the filtering; driving the
  // highlight here keeps Enter on the top row every time the results change.
  const [active, setActive] = useState(best)
  const [shown, setShown] = useState(matches)
  if (shown !== matches) {
    setShown(matches)
    setActive(best)
  }

  return (
    <Command shouldFilter={false} value={active} onValueChange={setActive}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search currency or code…"
      />
      <CommandList>
        {ready ? <CommandEmpty>No currency matches.</CommandEmpty> : null}
        {suggested.length > 0 && !searching ? (
          <>
            <CurrencyGroup
              heading="Frequent"
              keyPrefix="top"
              items={suggested}
              value={value}
              onPick={onPick}
            />
            <CommandSeparator />
          </>
        ) : null}
        <CurrencyGroup
          heading="All currencies"
          keyPrefix="all"
          items={matches}
          value={value}
          onPick={onPick}
        />
      </CommandList>
    </Command>
  )
}

/**
 * Searchable ISO-4217 picker: the table is ~155 entries now, so a plain select is not an
 * option. Search matches code or name; the base currency and recent picks sit on top.
 */
export function CurrencyPicker({
  value,
  onChange,
  base,
  label = 'Currency',
  disabled,
  className,
  align = 'start',
  isoOnly = false,
  appearance = 'well',
  prefix,
}: Props) {
  const pill = appearance === 'pill'
  const [open, setOpen] = useState(false)
  const all = useCurrencyList()
  const currencies = useMemo(
    () => (isoOnly ? all.filter((c) => c.custom !== true) : all),
    [all, isoOnly],
  )
  const recent = usePreferencesStore((s) => s.recentCurrencies)
  const noteUsed = usePreferencesStore((s) => s.noteCurrencyUsed)

  const suggested = useMemo(
    () => suggestedFor(currencies, base, value, recent),
    [currencies, base, value, recent],
  )

  const choose = useCallback(
    (code: string) => {
      noteUsed(code)
      onChange(code)
      setOpen(false)
    },
    [noteUsed, onChange],
  )

  return (
    // Modal: a dialog's scroll lock cancels touch-scrolling in a popover portalled outside it.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={label}
        className={cn(TRIGGER[appearance], className)}
      >
        {prefix ? (
          <span className="flex-none font-medium text-fp-text-3">{prefix}</span>
        ) : null}
        <span
          className={cn(
            'min-w-0 truncate',
            pill ? 'font-extrabold' : 'font-semibold',
          )}
        >
          {value}
        </span>
        {pill ? null : (
          <span className="truncate text-[12.5px] text-fp-text-3">
            {currencySymbol(value)}
          </span>
        )}
        <ChevronDown
          size={pill ? 14 : 16}
          className="ms-auto shrink-0 text-fp-text-3"
        />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[min(320px,calc(100vw-32px))] p-0"
      >
        {/* Building ~155 rows for a closed popover is what taxed every page holding a picker. */}
        {open ? (
          <CurrencyOptions
            currencies={currencies}
            suggested={suggested}
            value={value}
            onPick={choose}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
