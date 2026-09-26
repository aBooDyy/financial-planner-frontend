import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import { LEGACY_SOURCE_PREFIX } from './settle'

const byId = (a: LocalTransaction, b: LocalTransaction): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * The transactions that count toward a goal or settle a planned row: those with a `goalId`,
 * a `plannedId`, or a legacy auto-post `source`. Read through the indexes, which hold no
 * entry for a null key, so the unlinked bulk of the ledger is never loaded. Soft-deleted rows
 * are included; the result is in primary-key order, like a full-table read.
 */
export async function linkedTransactions(): Promise<LocalTransaction[]> {
  const [toGoal, toPlanned, legacy] = await Promise.all([
    db.transactions.orderBy('goalId').toArray(),
    db.transactions.orderBy('plannedId').toArray(),
    db.transactions.where('source').startsWith(LEGACY_SOURCE_PREFIX).toArray(),
  ])
  const unique = new Map<string, LocalTransaction>()
  for (const t of [...toGoal, ...toPlanned, ...legacy]) unique.set(t.id, t)
  return [...unique.values()].sort(byId)
}
