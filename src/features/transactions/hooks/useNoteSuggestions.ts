import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import {
  addDays,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import {
  NOTE_LOOKBACK_DAYS,
  rankNotes,
} from '#/features/transactions/data/noteSuggestions'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'

const NONE: string[] = []

/** The notes a `kind` entry's note field can complete to, best first. */
export function useNoteSuggestions(kind: EditorTxType): string[] {
  const from = ymd(addDays(startOfToday(), -NOTE_LOOKBACK_DAYS))
  const rows = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(from).toArray(),
    [from],
  )
  return useMemo(() => (rows ? rankNotes(rows, kind) : NONE), [rows, kind])
}
