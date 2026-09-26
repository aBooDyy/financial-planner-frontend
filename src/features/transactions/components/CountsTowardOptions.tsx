import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type {
  CountsOption,
  RankedOptions,
} from '#/features/transactions/data/countsToward'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  commandFilter,
} from '#/components/ui/command'

type Props = {
  options: RankedOptions
  isIncome: boolean
  selectedId: string | null
  onPick: (id: string | null) => void
  listClassName?: string
}

const NOTHING = '__nothing__'
const MORE = '__more__'

/** Names only: a sub-line's figures would make "4" match every goal with a 4 in it. */
const matchesFor = (
  options: ReadonlyArray<CountsOption>,
  query: string,
): CountsOption[] =>
  options
    .map((o) => ({ o, score: commandFilter(o.name, query) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.o)

function OptionRow({
  value,
  name,
  sub,
  color,
  checked,
  onSelect,
}: {
  value: string
  name: string
  sub: string
  color: string | null
  checked: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className={checked ? 'bg-fp-accent-soft' : undefined}
    >
      <span className="flex size-7 flex-none items-center justify-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: color ?? 'var(--fp-text-3)' }}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{name}</span>
        <span className="truncate text-[12px] text-fp-text-3">{sub}</span>
      </span>
      {checked ? (
        <Check
          size={16}
          strokeWidth={2.4}
          className="shrink-0 text-fp-accent-ink"
        />
      ) : null}
    </CommandItem>
  )
}

/**
 * What an entry counts toward: Nothing, the few most relevant goals / obligations (or income
 * streams), and the rest behind More… or a search by name.
 */
export function CountsTowardOptions({
  options,
  isIncome,
  selectedId,
  onPick,
  listClassName,
}: Props) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const all = useMemo(() => [...options.top, ...options.rest], [options])
  const search = query.trim()
  const matches = useMemo(
    () => (search ? matchesFor(all, search) : all),
    [all, search],
  )
  const suggested = !search && !showAll

  const row = (o: CountsOption) => (
    <OptionRow
      key={o.id}
      value={o.id}
      name={o.name}
      sub={o.sub}
      color={o.color}
      checked={o.id === selectedId}
      onSelect={() => onPick(o.id)}
    />
  )

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          isIncome ? 'Search income streams' : 'Search goals and bills'
        }
      />
      <CommandList className={listClassName}>
        <CommandEmpty>No matches</CommandEmpty>
        {search ? null : (
          <CommandGroup>
            <OptionRow
              value={NOTHING}
              name="Nothing"
              sub={isIncome ? 'Regular income' : 'Regular spending'}
              color={null}
              checked={selectedId === null}
              onSelect={() => onPick(null)}
            />
          </CommandGroup>
        )}
        {suggested ? (
          <CommandGroup heading="Suggested">
            {options.top.map(row)}
            {options.rest.length > 0 ? (
              <CommandItem value={MORE} onSelect={() => setShowAll(true)}>
                <span className="flex size-7 flex-none items-center justify-center">
                  <span className="flex size-[22px] items-center justify-center rounded-[7px] bg-fp-surface-2 text-fp-text-3">
                    <Plus size={13} strokeWidth={2.4} />
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">More…</span>
                  <span className="truncate text-[12px] text-fp-text-3">
                    {options.rest.length} more{' '}
                    {isIncome ? 'income streams' : 'goals and bills'}
                  </span>
                </span>
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : matches.length > 0 ? (
          <CommandGroup
            heading={isIncome ? 'All income streams' : 'All goals & bills'}
          >
            {matches.map(row)}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}
