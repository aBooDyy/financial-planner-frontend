import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { formatMoney } from '#/lib/currency'
import { formatDate, parseISODate } from '#/lib/date'
import { usePreferencesStore } from '#/stores/preferences'
import type { LocalTransaction } from '#/db/types'

/**
 * Names the ledger rows the duplicate marks point at. Only the matched ids are read — a file
 * repeats a handful of transactions, not the whole ledger — and the ids come from the pass,
 * so naming them costs no rows at all.
 */
export function useDuplicateTargets(
  ids: ReadonlyArray<string>,
): (id: string) => string | null {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  const key = ids.join(',')
  const matched = useLiveQuery(
    async (): Promise<Array<LocalTransaction | undefined>> =>
      ids.length === 0 ? [] : db.transactions.bulkGet([...ids]),
    [key],
  )

  return useMemo(() => {
    const labels = new Map<string, string>()
    for (const row of matched ?? []) {
      if (row === undefined) continue
      const date = parseISODate(row.date)
      labels.set(
        row.id,
        `${formatMoney(row.amount, row.currency)}${
          date === null ? '' : ` on ${formatDate(date, dateFormat)}`
        }`,
      )
    }
    return (id: string) => labels.get(id) ?? null
  }, [matched, dateFormat])
}
