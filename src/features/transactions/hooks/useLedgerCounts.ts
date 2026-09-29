import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { countsFromTotals } from '#/features/transactions/data/ledgerTotals'

type CountedKind = 'category' | 'merchant'

/**
 * Live ledger rows per category or merchant id, read from the stored totals rather than the
 * ledger. An id with no rows is absent.
 */
export function useLedgerCounts(kind: CountedKind): Map<string, number> {
  const totals = useLiveQuery(
    () => db.ledgerTotals.where('kind').equals(kind).toArray(),
    [kind],
  )
  return useMemo(() => countsFromTotals(totals ?? []), [totals])
}
