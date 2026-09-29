import type { LocalBalanceNode } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { walletMatcher } from '#/features/transactions/data/selectors'
import type { Scope } from '#/features/transactions/data/selectors'
import { activeNodes } from '#/features/wallets/data/archive'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { balanceAt, buildBalanceStrip } from './balances'
import type { BalanceStrip } from './balances'
import { buildCategoryBreakdown } from './breakdown'
import type { CategoryBreakdown } from './breakdown'
import { bucketsOf } from './buckets'
import { flowRowsOf, rowsIn, sumOf } from './flowRows'
import { buildLargest } from './largest'
import type { LargestItem } from './largest'
import type { ReportRange } from './range'
import type { ReportLedger } from './reads'
import { buildSummary } from './summary'
import type { SummaryView } from './summary'
import { buildTrend } from './trend'
import type { TrendView } from './trend'

export type ReportView = {
  summary: SummaryView
  trend: TrendView
  balance: BalanceStrip
  breakdown: { spend: CategoryBreakdown; income: CategoryBreakdown }
  largest: LargestItem[]
}

export type ReportInputs = {
  ledger: ReportLedger
  nodes: ReadonlyArray<LocalBalanceNode>
  scope: Scope
  range: ReportRange
  today: Date
  catalog: CategoryCatalog
  base: CurrencyCode
  rates: RatesMap
}

export function buildReport({
  ledger,
  nodes,
  scope,
  range,
  today,
  catalog,
  base,
  rates,
}: ReportInputs): ReportView {
  const inScope = walletMatcher(scope, [...nodes])
  const flow = flowRowsOf(ledger.rows, inScope, base, rates)
  const cur = rowsIn(flow, range)
  const prev = range.compare ? rowsIn(flow, range.compare) : null

  const wallets = activeNodes(nodes).filter(
    (n) => n.kind === 'wallet' && inScope(n.id),
  )
  const balance = balanceAt({
    wallets,
    before: ledger.before,
    rows: rowsIn(ledger.rows, range),
    base,
    rates,
  })

  return {
    summary: buildSummary(cur, prev, range.compare?.caption ?? null, base),
    trend: buildTrend(cur, bucketsOf(range, today), range, balance, base),
    balance: buildBalanceStrip(
      balance,
      range,
      sumOf(cur, 'income') - sumOf(cur, 'spend'),
      scope.type === 'all',
      base,
    ),
    breakdown: {
      spend: buildCategoryBreakdown(cur, prev, 'spend', catalog, base),
      income: buildCategoryBreakdown(cur, prev, 'income', catalog, base),
    },
    largest: buildLargest(cur, catalog, ledger.merchantNames, base),
  }
}
