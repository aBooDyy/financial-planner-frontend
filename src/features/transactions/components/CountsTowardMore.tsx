import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CountsOption } from '#/features/transactions/data/countsToward'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  commandFilter,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'

type Props = {
  options: ReadonlyArray<CountsOption>
  isIncome: boolean
  onSelect: (id: string) => void
}

const TRIGGER =
  'flex w-full cursor-pointer items-center gap-[10px] rounded-[12px] border border-dashed border-fp-border-strong bg-fp-surface-2 px-[12px] py-[9px] text-start outline-none hover:border-fp-text-3 focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15'

/** Names only: a sub-line's figures would make "4" match every goal with a 4 in it. */
const matchesFor = (
  options: ReadonlyArray<CountsOption>,
  query: string,
): CountsOption[] => {
  const search = query.trim()
  if (search === '') return [...options]
  return options
    .map((o) => ({ o, score: commandFilter(o.name, search) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.o)
}

function OptionItem({
  option,
  onPick,
}: {
  option: CountsOption
  onPick: (id: string) => void
}) {
  return (
    <CommandItem value={option.id} onSelect={() => onPick(option.id)}>
      <span
        aria-hidden
        className="size-[9px] flex-none rounded-full"
        style={{ background: option.color }}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{option.name}</span>
        <span className="truncate text-[11.5px] text-fp-text-3">
          {option.sub}
        </span>
      </span>
    </CommandItem>
  )
}

function MoreOptions({ options, isIncome, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => matchesFor(options, query), [options, query])
  const best = matches[0]?.id ?? ''
  // cmdk highlights the best match itself only while it owns the filtering.
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
        placeholder={
          isIncome ? 'Search income streams…' : 'Search goals & obligations…'
        }
      />
      <CommandList>
        <CommandEmpty>
          {isIncome ? 'No income stream matches.' : 'No goal matches.'}
        </CommandEmpty>
        {matches.length > 0 ? (
          <CommandGroup>
            {matches.map((o) => (
              <OptionItem key={o.id} option={o} onPick={onSelect} />
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}

/** The options past the top few, searchable by name. Picking one is the same as tapping a card. */
export function CountsTowardMore({ options, isIncome, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const pick = (id: string) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="More" className={TRIGGER}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-semibold text-fp-text-2">
            More…
          </span>
          <span className="truncate text-[11.5px] text-fp-text-3">
            Search {options.length} more
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-[min(280px,calc(100vw-32px))] p-0"
      >
        {open ? (
          <MoreOptions options={options} isIncome={isIncome} onSelect={pick} />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
