import { useDeferredValue, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { FIELD_WELL } from '#/components/ui/field-well'
import { cn } from '#/lib/utils'
import type { TargetGroup, TargetOption } from '#/features/import/data/values'

type Props = {
  value: string
  onChange: (value: string) => void
  groups: ReadonlyArray<TargetGroup>
  /** Answers that are not a target — "needs a match", "no account" — listed above the groups. */
  leading?: ReadonlyArray<TargetOption>
  /** Actions listed below the groups — create one, skip these rows. */
  trailing?: ReadonlyArray<TargetOption>
  placeholder: string
  searchPlaceholder?: string
  /** An option that may not be picked here, such as a transfer's own account. */
  exclude?: string
  id?: string
  ariaLabel?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
}

const TRIGGER = cn(
  FIELD_WELL,
  'flex h-auto w-full cursor-pointer items-center gap-[10px] text-start',
)

function OptionIcon({ option }: { option: TargetOption }) {
  if (!option.icon || !option.color) return null
  return (
    <IconChip
      id={option.icon}
      color={option.color}
      size={22}
      iconSize={13}
      className="rounded-[6px]"
    />
  )
}

const find = (
  value: string,
  lists: ReadonlyArray<ReadonlyArray<TargetOption>>,
): TargetOption | null => {
  for (const list of lists) {
    const hit = list.find((option) => option.value === value)
    if (hit) return hit
  }
  return null
}

type Section = {
  key: string
  heading: string | null
  band: string | null
  options: TargetOption[]
}

/** Neighbouring groups of one band stay together, whichever group was moved to the front. */
const byBand = (groups: ReadonlyArray<TargetGroup>): TargetGroup[] => {
  const order: Array<string | null> = []
  for (const group of groups) {
    const band = group.section ?? null
    if (!order.includes(band)) order.push(band)
  }
  return order.flatMap((band) =>
    groups.filter((group) => (group.section ?? null) === band),
  )
}

const BAND =
  'sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-fp-surface px-3 pt-3 pb-1 text-[11px] font-bold tracking-[0.06em] text-fp-text uppercase after:h-px after:flex-1 after:bg-fp-border'

const TAG =
  'shrink-0 rounded-full bg-fp-surface px-2 py-[2px] text-[11px] font-semibold text-fp-text-2 ring-1 ring-fp-border'

/** Case- and accent-blind, so "cafe" finds "Café". */
const fold = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/**
 * Every word typed must appear in the option's name or its group's: a category's name finds
 * its children, and a group with no hits disappears with them. Plain substrings rather than
 * cmdk's fuzzy scorer, which matches letters scattered across unrelated names.
 */
const sectionsFor = (
  sections: ReadonlyArray<Section>,
  query: string,
): Section[] => {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return sections.filter((s) => s.options.length > 0)
  return sections
    .map((section) => ({
      ...section,
      options: section.options.filter((option) => {
        const haystack = fold(`${option.label} ${section.heading ?? ''}`)
        return words.every((word) => haystack.includes(word))
      }),
    }))
    .filter((section) => section.options.length > 0)
}

type Band = { key: string; band: string | null; sections: Section[] }

/** Consecutive sections of one band share a wrapper, so its sticky header spans them all. */
const bandsOf = (sections: ReadonlyArray<Section>): Band[] => {
  const bands: Band[] = []
  for (const section of sections) {
    const last = bands.at(-1)
    if (last && last.band !== null && last.band === section.band) {
      last.sections.push(section)
    } else {
      bands.push({ key: section.key, band: section.band, sections: [section] })
    }
  }
  return bands
}

type ListProps = {
  sections: ReadonlyArray<Section>
  value: string
  searchPlaceholder: string
  onPick: (value: string) => void
}

function TargetOptions({
  sections,
  value,
  searchPlaceholder,
  onPick,
}: ListProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const shown = useMemo(
    () => sectionsFor(sections, deferredQuery),
    [sections, deferredQuery],
  )
  const first = shown[0]?.options[0]?.value ?? ''
  const [active, setActive] = useState(value)
  const [lastShown, setLastShown] = useState(shown)
  if (lastShown !== shown) {
    setLastShown(shown)
    setActive(first)
  }

  return (
    <Command shouldFilter={false} value={active} onValueChange={setActive}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={searchPlaceholder}
      />
      <CommandList className="max-h-[min(340px,50vh)]">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {bandsOf(shown).map((band, index) => (
          <div key={band.key}>
            {band.band !== null ? (
              <div role="presentation" className={BAND}>
                {band.band}
              </div>
            ) : index > 0 ? (
              <CommandSeparator />
            ) : null}
            {band.sections.map((section) => (
              <CommandGroup
                key={section.key}
                heading={section.heading ?? undefined}
              >
                {section.options.map((option) => {
                  const selected = option.value === value
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => onPick(option.value)}
                      className={cn(
                        option.name && section.heading ? 'ps-4' : '',
                        selected ? 'font-semibold text-fp-accent-ink' : '',
                      )}
                    >
                      <OptionIcon option={option} />
                      <span className="min-w-0 flex-1 truncate">
                        {option.name ?? option.label}
                      </span>
                      {selected ? (
                        <Check
                          size={14}
                          className="shrink-0 text-fp-accent-ink"
                        />
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </div>
        ))}
      </CommandList>
    </Command>
  )
}

/** A searchable pick of one account or category, each shown with its own icon. */
export function TargetPicker({
  value,
  onChange,
  groups,
  leading = [],
  trailing = [],
  placeholder,
  searchPlaceholder = 'Search…',
  exclude,
  id,
  ariaLabel,
  invalid,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false)

  const chosen = useMemo(
    () =>
      find(value, [leading, ...groups.map((group) => group.options), trailing]),
    [value, leading, groups, trailing],
  )

  // Built only while open: a screen of value rows each holding the whole catalogue is what a
  // closed picker must not pay for.
  const sections = useMemo((): Section[] => {
    if (!open) return []
    const keep = (option: TargetOption) => option.value !== exclude
    return [
      {
        key: 'leading',
        heading: null,
        band: null,
        options: leading.filter(keep),
      },
      ...byBand(groups).map((group, index) => ({
        key: `group-${index}-${group.label ?? ''}`,
        heading: group.label,
        band: group.section ?? null,
        options: group.options.filter(keep),
      })),
      {
        key: 'trailing',
        heading: null,
        band: null,
        options: trailing.filter(keep),
      },
    ]
  }, [open, leading, groups, trailing, exclude])

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={cn(TRIGGER, className)}
      >
        {chosen ? <OptionIcon option={chosen} /> : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            !chosen && 'font-medium text-fp-text-3',
          )}
        >
          {chosen ? chosen.label : placeholder}
        </span>
        {chosen?.tag ? <span className={TAG}>{chosen.tag}</span> : null}
        <ChevronDown size={16} className="shrink-0 text-fp-text-3" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[max(var(--radix-popover-trigger-width),min(300px,calc(100vw-32px)))] p-0"
      >
        {open ? (
          <TargetOptions
            sections={sections}
            value={value}
            searchPlaceholder={searchPlaceholder}
            onPick={pick}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
