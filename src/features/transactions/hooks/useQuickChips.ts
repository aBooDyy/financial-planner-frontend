import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, localDbGeneration } from '#/db/db'
import { useDebouncedValue } from '#/hooks/useDebouncedValue'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import {
  addDays,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import {
  AMOUNT_MATCH_LOOKBACK_DAYS,
  QUICK_CHIP_COUNT,
  QUICK_CHIP_LOOKBACK_DAYS,
  quickChips,
} from '#/features/transactions/data/quickChips'
import type { QuickChip } from '#/features/transactions/data/quickChips'
import type { CurrencyCode } from '#/lib/currency'

/** Long enough that typing "120" doesn't flash the matches for "1" and "12" on the way. */
const AMOUNT_SETTLE_MS = 350

/**
 * The last amount-free ranking per type and count. A remount shows it while its queries
 * resolve, so the row doesn't flash the catalog's defaults before the user's favourites land.
 */
const lastRanked = new Map<string, QuickChip[]>()

/**
 * Quick add's one-tap categories for `type`: what the user reaches for most, lately — led by
 * whatever they recently filed the typed `amount` under.
 */
export function useQuickChips(
  type: TxType,
  count: number = QUICK_CHIP_COUNT,
  amount: { minor: number | null; currency: CurrencyCode } | null = null,
): QuickChip[] {
  const { catalog, loaded } = useCategoryCatalogState()
  const today = startOfToday()
  const from = ymd(addDays(today, -QUICK_CHIP_LOOKBACK_DAYS))
  const amountFrom = ymd(addDays(today, -AMOUNT_MATCH_LOOKBACK_DAYS))
  const rows = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(from).toArray(),
    [from],
  )
  const minor = useDebouncedValue(amount?.minor ?? null, AMOUNT_SETTLE_MS)
  const currency = amount?.currency ?? null
  // Never across a sign-out: the previous user's categories are not this one's.
  const key = `${localDbGeneration()}:${type}:${count}`

  return useMemo(() => {
    if (!rows || !loaded) return lastRanked.get(key) ?? []
    const hint =
      minor && minor > 0 && currency
        ? { minor, currency, from: amountFrom }
        : null
    const ranked = quickChips({
      rows,
      type,
      catalog,
      from,
      count,
      amount: hint,
    })
    if (!hint) lastRanked.set(key, ranked)
    return ranked
  }, [
    rows,
    loaded,
    key,
    type,
    catalog,
    from,
    count,
    minor,
    currency,
    amountFrom,
  ])
}
