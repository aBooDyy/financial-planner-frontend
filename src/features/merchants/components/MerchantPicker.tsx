import { useState } from 'react'
import { Check, ChevronDown, Plus, Store, X } from 'lucide-react'
import type { LocalMerchant } from '#/db/types'
import { identityKey } from '#/features/merchants/data/matching'
import {
  createMerchant,
  isUsableAlias,
} from '#/features/merchants/data/mutations'
import { useMerchants } from '#/features/merchants/hooks/useMerchants'
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
import { cn } from '#/lib/utils'

type Props = {
  value: string | null
  /** The chosen merchant, or null when cleared. */
  onChange: (merchant: LocalMerchant | null) => void
  /** Shown while the reactive cache catches up with a merchant created a moment ago. */
  valueName?: string
  label?: string
  className?: string
}

const TRIGGER =
  'flex h-auto w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-input bg-fp-surface-2 px-[13px] py-3 text-[14px] text-fp-text transition outline-none focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15'

/**
 * Search the synced merchant cache, or file a new one. Searching covers every spelling a
 * merchant answers to, so a card alert's `CARREFOUR 402` finds the shop the user named
 * "Carrefour".
 */
export function MerchantPicker({
  value,
  onChange,
  valueName,
  label = 'Merchant',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { merchants } = useMerchants()

  const selected = merchants.find((m) => m.id === value) ?? null
  const shownName = selected?.displayName ?? (value ? valueName : '')
  const trimmed = query.trim()
  const key = identityKey(trimmed)
  const creatable = isUsableAlias(trimmed)
  const exists = merchants.some(
    (m) =>
      identityKey(m.displayName) === key ||
      m.aliases.some((a) => a.normalizedKey === key),
  )

  const choose = (merchant: LocalMerchant | null) => {
    onChange(merchant)
    setOpen(false)
    setQuery('')
  }

  const create = () => {
    void createMerchant({ displayName: trimmed }).then(choose)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setQuery('')
      }}
    >
      <PopoverTrigger aria-label={label} className={cn(TRIGGER, className)}>
        <Store size={15} className="shrink-0 text-fp-text-3" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start',
            shownName ? 'font-semibold' : 'text-fp-text-3',
          )}
        >
          {shownName || 'Not set'}
        </span>
        <ChevronDown size={16} className="shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(340px,calc(100vw-32px))] p-0"
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search or add a merchant…"
          />
          <CommandList>
            <CommandEmpty>No merchant matches.</CommandEmpty>
            {trimmed && !exists ? (
              <>
                <CommandGroup>
                  <CommandItem
                    value={`__create__ ${trimmed}`}
                    disabled={!creatable}
                    onSelect={create}
                  >
                    <Plus size={14} className="shrink-0 text-fp-accent-ink" />
                    <span className="min-w-0 flex-1 truncate">
                      {creatable
                        ? `Add “${trimmed}”`
                        : 'Add a Latin letter or digit so this can be recognised'}
                    </span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            {value ? (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => choose(null)}
                    className="text-fp-text-3"
                  >
                    <X size={14} className="shrink-0" />
                    <span>Clear merchant</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            <CommandGroup heading="Merchants">
              {merchants.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.displayName} ${m.aliases
                    .map((a) => `${a.rawSample ?? ''} ${a.normalizedKey}`)
                    .join(' ')}`}
                  onSelect={() => choose(m)}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {m.displayName}
                  </span>
                  {m.timesSeen > 0 ? (
                    <span className="shrink-0 text-[11.5px] text-fp-text-3 tabular-nums">
                      {m.timesSeen}×
                    </span>
                  ) : null}
                  {m.id === value ? (
                    <Check size={14} className="shrink-0 text-fp-accent-ink" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
