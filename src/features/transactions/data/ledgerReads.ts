import { db } from '#/db/db'
import type { LocalBudget, LocalTransaction } from '#/db/types'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { walletDeltasFromTotals } from './ledgerTotals'
import { ledgerRanges } from './ledgerRange'
import { fromIsoPeriod, parseISO } from './planning'
import type { IsoPeriod } from './planning'

/**
 * The rows one period of the Spending page reads, tagged with the period they answer and the
 * budgets whose windows they were read for — so the two can never disagree.
 */
export type LedgerWindow = {
  period: IsoPeriod
  today: string
  budgets: LocalBudget[]
  rows: LocalTransaction[]
}

// Primary-key order, as a full-table read returns it: the builders' stable sorts break ties by
// arrival, so the date index's order would reorder equal totals.
const byId = (a: LocalTransaction, b: LocalTransaction): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

export async function readLedgerWindow(
  period: IsoPeriod,
  today: string,
): Promise<LedgerWindow> {
  const budgets = await db.budgets.toArray()
  const ranges = ledgerRanges(fromIsoPeriod(period), parseISO(today), budgets)
  const rows = await db.transactions
    .where('date')
    .inAnyRange(ranges, { includeUppers: true })
    .toArray()
  return { period, today, budgets, rows: rows.sort(byId) }
}

// Balances sum every row, so no window serves them: they come from the running totals the
// database keeps alongside the ledger.
async function readWalletTotals() {
  const nodes = await db.balanceNodes.toArray()
  const totals = await db.ledgerTotals.where('kind').equals('wallet').toArray()
  return { nodes: nodes.filter((n) => n.deleted === 0), totals }
}

/** Each wallet's signed delta over the whole ledger (`walletDeltas`). */
export async function readWalletDeltas(
  rates: RatesMap,
): Promise<Record<string, number>> {
  const { nodes, totals } = await readWalletTotals()
  return walletDeltasFromTotals(nodes, totals, rates)
}

/** What the Wallets page derives from the whole ledger. */
export type LedgerSummary = {
  deltas: Record<string, number>
  /** Every currency a row is in, deleted rows included. */
  currencies: CurrencyCode[]
}

export async function readLedgerSummary(
  rates: RatesMap,
): Promise<LedgerSummary> {
  const { nodes, totals } = await readWalletTotals()
  const currencies = await db.ledgerTotals
    .where('kind')
    .equals('currency')
    .toArray()
  return {
    deltas: walletDeltasFromTotals(nodes, totals, rates),
    currencies: currencies.map((t) => t.ref),
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
