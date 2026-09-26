import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import {
  addDays,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import {
  QUICK_CHIP_COUNT,
  QUICK_CHIP_LOOKBACK_DAYS,
  quickChips,
} from '#/features/transactions/data/quickChips'
import type { QuickChip } from '#/features/transactions/data/quickChips'

/** Quick add's one-tap categories for `type`: what the user reaches for most, lately. */
export function useQuickChips(
  type: TxType,
  count: number = QUICK_CHIP_COUNT,
): QuickChip[] {
  const catalog = useCategoryCatalog()
  const from = ymd(addDays(startOfToday(), -QUICK_CHIP_LOOKBACK_DAYS))
  const rows = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(from).toArray(),
    [from],
  )
  return useMemo(
    () => quickChips({ rows: rows ?? [], type, catalog, from, count }),
    [rows, type, catalog, from, count],
  )
}
