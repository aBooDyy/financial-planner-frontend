import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'

const byId = (a: LocalTransaction, b: LocalTransaction): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * The transactions that link to planning: those with a `goalId`, a `billId` or a `plannedId`.
 * Read through the indexes, which hold no entry for a null key, so the unlinked bulk of the
 * ledger is never loaded. Soft-deleted rows are included; the result is in primary-key order,
 * like a full-table read.
 */
export async function linkedTransactions(): Promise<LocalTransaction[]> {
  const [toGoal, toBill, toPlanned] = await Promise.all([
    db.transactions.orderBy('goalId').toArray(),
    db.transactions.orderBy('billId').toArray(),
    db.transactions.orderBy('plannedId').toArray(),
  ])
  const unique = new Map<string, LocalTransaction>()
  for (const t of [...toGoal, ...toBill, ...toPlanned]) unique.set(t.id, t)
  return [...unique.values()].sort(byId)
}
