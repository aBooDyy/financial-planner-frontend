import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { mergeRanges } from '#/features/transactions/data/ledgerRange'
import type { IsoRange } from '#/features/transactions/data/ledgerRange'
import type { RatesMap } from '#/lib/config/rates'

/** What one report reads from the ledger. */
export type ReportLedger = {
  /** The spans the rows answer, so a caller can tell a previous answer from the current. */
  key: string
  /** Every row dated in the period or its comparison, of any type. */
  rows: LocalTransaction[]
  /** Each wallet's signed delta from every row dated before the period. */
  before: Record<string, number>
  merchantNames: Map<string, string>
}

export const ledgerKey = (spans: ReadonlyArray<IsoRange>): string =>
  spans.map(([from, to]) => `${from}..${to}`).join(',')

/**
 * The period's rows and the balance that went before it. The earlier rows only feed a
 * per-wallet sum, reduced inside the query so they never reach React.
 */
export async function readReportLedger(
  spans: ReadonlyArray<IsoRange>,
  periodStart: string,
  rates: RatesMap,
): Promise<ReportLedger> {
  const [rows, earlier, nodes, merchants] = await Promise.all([
    db.transactions
      .where('date')
      .inAnyRange(mergeRanges(spans), { includeUppers: true })
      .toArray(),
    db.transactions.where('date').below(periodStart).toArray(),
    db.balanceNodes.toArray(),
    db.merchants.toArray(),
  ])
  return {
    key: ledgerKey(spans),
    rows,
    before: walletDeltas(
      nodes.filter((n) => n.deleted === 0),
      earlier,
      rates,
    ),
    merchantNames: new Map(
      merchants
        .filter((m) => m.deleted === 0)
        .map((m) => [m.id, m.displayName]),
    ),
  }
}
