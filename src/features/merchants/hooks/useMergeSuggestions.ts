import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { mergeSuggestions } from '#/features/merchants/data/suggestions'
import type { MergeSuggestion } from '#/features/merchants/data/suggestions'

/**
 * Near-duplicate merchants, recomputed only when the tables change. Read from Dexie
 * directly rather than through `useMerchantIndex`, whose object is new on every render and
 * would re-run the whole pass each time.
 */
export function useMergeSuggestions(): MergeSuggestion[] {
  const merchants = useLiveQuery(() => db.merchants.toArray())
  const aliases = useLiveQuery(() => db.merchantAliases.toArray())

  return useMemo(
    () =>
      mergeSuggestions({
        merchants: merchants ?? [],
        aliases: (aliases ?? []).filter((alias) => alias.deleted === 0),
      }),
    [merchants, aliases],
  )
}
