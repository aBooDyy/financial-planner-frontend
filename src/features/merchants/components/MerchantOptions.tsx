import { useState } from 'react'
import { Check, Plus, Store, X } from 'lucide-react'
import type { LocalMerchant } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { identityKey } from '#/features/merchants/data/matching'
import {
  createMerchant,
  isUsableAlias,
} from '#/features/merchants/data/mutations'
import { predictionFor } from '#/features/merchants/hooks/useMerchantMatch'
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

type Props = {
  value: string | null
  /** The chosen merchant, or null when cleared. */
  onPick: (merchant: LocalMerchant | null) => void
  listClassName?: string
}

const TILE =
  'flex size-7 flex-none items-center justify-center rounded-[8px] bg-fp-surface-2 text-fp-text-2'

/**
 * Search the synced merchant cache, or file a new one. Searching covers every spelling a
 * merchant answers to, so a card alert's `CARREFOUR 402` finds the shop the user named
 * "Carrefour".
 */
export function MerchantOptions({ value, onPick, listClassName }: Props) {
  const [query, setQuery] = useState('')
  const { merchants } = useMerchants()
  const catalog = useCategoryCatalog()

  const trimmed = query.trim()
  const key = identityKey(trimmed)
  const creatable = isUsableAlias(trimmed)
  const exists = merchants.some(
    (m) =>
      identityKey(m.displayName) === key ||
      m.aliases.some((a) => a.normalizedKey === key),
  )

  const learned = (merchant: LocalMerchant): string => {
    const p = predictionFor(merchant)
    if (!p || !catalog.has(p.categoryId)) return ''
    const label = catalog.labelOf(p.categoryId)
    return p.apply ? `Auto-categorised as ${label}` : `Usually ${label}`
  }

  return (
    <Command>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search or add a merchant…"
      />
      <CommandList className={listClassName}>
        <CommandEmpty>
          {merchants.length === 0 ? (
            <FirstMerchantHint />
          ) : (
            'No merchant matches.'
          )}
        </CommandEmpty>
        {trimmed && !exists ? (
          <>
            <CommandGroup>
              <CommandItem
                value={`__create__ ${trimmed}`}
                disabled={!creatable}
                onSelect={() =>
                  void createMerchant({ displayName: trimmed }).then(onPick)
                }
              >
                <span className={`${TILE} text-fp-accent-ink`}>
                  <Plus size={15} strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">
                    {creatable ? `Add “${trimmed}”` : 'Can’t add this name'}
                  </span>
                  <span className="truncate text-[12px] text-fp-text-3">
                    {creatable
                      ? 'Create a new merchant'
                      : 'Add a Latin letter or digit so this can be recognised'}
                  </span>
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        {value && !trimmed ? (
          <>
            <CommandGroup>
              <CommandItem value="__clear__" onSelect={() => onPick(null)}>
                <span className={TILE}>
                  <X size={15} strokeWidth={2.2} />
                </span>
                <span className="font-bold">No merchant</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        {merchants.length > 0 ? (
          <CommandGroup heading="Merchants">
            {merchants.map((m) => {
              const sub = learned(m)
              return (
                <CommandItem
                  key={m.id}
                  value={`${m.displayName} ${m.aliases
                    .map((a) => `${a.rawSample ?? ''} ${a.normalizedKey}`)
                    .join(' ')}`}
                  onSelect={() => onPick(m)}
                >
                  <span className={TILE}>
                    <Store size={14} strokeWidth={2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{m.displayName}</span>
                    {sub ? (
                      <span className="truncate text-[12px] text-fp-text-3">
                        {sub}
                      </span>
                    ) : null}
                  </span>
                  {m.id === value ? (
                    <Check
                      size={16}
                      strokeWidth={2.4}
                      className="shrink-0 text-fp-accent-ink"
                    />
                  ) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}

function FirstMerchantHint() {
  return (
    <span className="flex flex-col items-center gap-2 px-4">
      <span className={TILE}>
        <Store size={14} strokeWidth={2} />
      </span>
      <span className="font-bold text-fp-text">No merchants yet</span>
      <span>
        Type the shop or payee above to add it — we’ll remember it next time.
      </span>
    </span>
  )
}
