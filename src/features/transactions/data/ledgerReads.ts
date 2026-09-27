import { db } from '#/db/db'
import type { LocalBudget, LocalTransaction } from '#/db/types'
import type { RangeMode } from '#/features/transactions/constants'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { walletDeltas } from './ledger'
import { ledgerRanges } from './ledgerRange'
import { parseISO } from './planning'

/**
 * The rows one period of the Spending page reads, tagged with the period they answer and the
 * budgets whose windows they were read for — so the two can never disagree.
 */
export type LedgerWindow = {
  anchor: string
  mode: RangeMode
  today: string
  budgets: LocalBudget[]
  rows: LocalTransaction[]
}

// Primary-key order, as a full-table read returns it: the builders' stable sorts break ties by
// arrival, so the date index's order would reorder equal totals.
const byId = (a: LocalTransaction, b: LocalTransaction): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

export async function readLedgerWindow(
  anchor: string,
  mode: RangeMode,
  today: string,
): Promise<LedgerWindow> {
  const budgets = await db.budgets.toArray()
  const ranges = ledgerRanges(parseISO(anchor), mode, parseISO(today), budgets)
  const rows = await db.transactions
    .where('date')
    .inAnyRange(ranges, { includeUppers: true })
    .toArray()
  return { anchor, mode, today, budgets, rows: rows.sort(byId) }
}

// A balance sums every row, so no window can serve these reads; each reduces the ledger
// inside its query so only what it derives reaches React.
async function readWholeLedger() {
  const nodes = await db.balanceNodes.toArray()
  const txns = await db.transactions.toArray()
  return { nodes: nodes.filter((n) => n.deleted === 0), txns }
}

/** Each wallet's signed delta over the whole ledger (`walletDeltas`). */
export async function readWalletDeltas(
  rates: RatesMap,
): Promise<Record<string, number>> {
  const { nodes, txns } = await readWholeLedger()
  return walletDeltas(nodes, txns, rates)
}

/** What the Wallets page derives from the whole ledger. */
export type LedgerSummary = {
  deltas: Record<string, number>
  /** Every currency a row is in, deleted rows included. */
  currencies: CurrencyCode[]
  /** Every goal-linked row, deleted ones included — all that goal progress reads. */
  goalLinked: LocalTransaction[]
}

export async function readLedgerSummary(
  rates: RatesMap,
): Promise<LedgerSummary> {
  const { nodes, txns } = await readWholeLedger()
  return {
    deltas: walletDeltas(nodes, txns, rates),
    currencies: [...new Set(txns.map((t) => t.currency))],
    goalLinked: txns.filter((t) => t.goalId !== null),
  }
}

/** Every row dated on or after `from` (ISO), in primary-key order. */
export async function readLedgerSince(
  from: string,
): Promise<LocalTransaction[]> {
  const rows = await db.transactions.where('date').aboveOrEqual(from).toArray()
  return rows.sort(byId)
}

/** A transfer's live legs, wherever their dates fall. */
export async function readTransferLegs(
  transferId: string,
): Promise<LocalTransaction[]> {
  const rows = await db.transactions
    .where('transferId')
    .equals(transferId)
    .toArray()
  return rows.filter((t) => t.deleted === 0)
}
