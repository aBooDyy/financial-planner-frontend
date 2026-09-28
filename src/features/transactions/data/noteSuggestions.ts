import type { LocalTransaction } from '#/db/types'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'

/** How far back past notes are offered as completions. */
export const NOTE_LOOKBACK_DAYS = 365

/** Fewer typed characters than this match too much to be worth a guess. */
const MIN_TYPED = 2

const kindOf = (type: LocalTransaction['type']): EditorTxType | null =>
  type === 'spend' || type === 'income'
    ? type
    : type === 'transfer_out' || type === 'transfer_in'
      ? 'transfer'
      : null

/** The distinct notes left on `kind` entries, most used first, ties to the most recent. */
export function rankNotes(
  rows: ReadonlyArray<LocalTransaction>,
  kind: EditorTxType,
): string[] {
  const seen = new Map<string, { note: string; count: number; last: string }>()
  for (const row of rows) {
    const note = row.note?.trim()
    if (row.deleted !== 0 || !note || kindOf(row.type) !== kind) continue
    const key = note.toLocaleLowerCase()
    const hit = seen.get(key)
    if (!hit) seen.set(key, { note, count: 1, last: row.date })
    else {
      hit.count += 1
      if (row.date > hit.last) Object.assign(hit, { note, last: row.date })
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .map((n) => n.note)
}

/** What would finish `typed` as the best-ranked note it starts, or null when none does. */
export function noteCompletion(
  ranked: ReadonlyArray<string>,
  typed: string,
): string | null {
  if (typed.trim().length < MIN_TYPED || typed.trimStart() !== typed)
    return null
  const prefix = typed.toLocaleLowerCase()
  const match = ranked.find(
    (note) =>
      note.length > typed.length && note.toLocaleLowerCase().startsWith(prefix),
  )
  return match ? match.slice(typed.length) : null
}
