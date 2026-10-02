import type { LocalBalanceNode, LocalSetAside } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { walletMatcher } from '#/features/transactions/data/selectors'
import type { Scope } from '#/features/transactions/data/selectors'
import { activeNodes } from '#/features/wallets/data/archive'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { balanceAt, buildBalanceStrip } from './balances'
import type { BalanceStrip } from './balances'
import { buildCategoryBreakdown } from './breakdown'
import type { CategoryBreakdown } from './breakdown'
import { bucketsOf } from './buckets'
import { flowRowsOf, rowsIn, sumOf } from './flowRows'
import type { FlowRow } from './flowRows'
import { buildLargest } from './largest'
import type { LargestItem } from './largest'
import { isSavingSpend } from './needsWants'
import { buildNeedsWants } from './needsWantsCard'
import type { NeedsWantsView } from './needsWantsCard'
import type { ReportRange, ReportWindow } from './range'
import type { ReportLedger } from './reads'
import { buildSummary } from './summary'
import type { SummaryView } from './summary'
import { buildTrend } from './trend'
import type { TrendView } from './trend'

export type ReportView = {
  summary: SummaryView
  trend: TrendView
  balance: BalanceStrip
  needsWants: NeedsWantsView
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

/** Goal set-asides dated in the window: a wallet's when it is in scope, one held outside only unscoped. */
function goalSetAsideIn(
  setAsides: ReadonlyArray<LocalSetAside>,
  win: Pick<ReportWindow, 'start' | 'dataEnd'>,
  inScope: (walletId: string) => boolean,
  allAccounts: boolean,
  base: CurrencyCode,
  rates: RatesMap,
): number {
  return rowsIn(setAsides, win)
    .filter((a) =>
      a.source === 'wallet' && a.walletId ? inScope(a.walletId) : allAccounts,
    )
    .reduce(
      (sum, a) => sum + convertMinor(a.amount, a.currency, base, rates),
      0,
    )
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
  const all = rowsIn(flow, range)
  const allPrev = range.compare ? rowsIn(flow, range.compare) : null
  // Money put into a Savings category was kept, not spent: every "Spending" figure skips it.
  const isSaving = (r: FlowRow) => isSavingSpend(catalog, r)
  const cur = all.filter((r) => !isSaving(r))
  const prev = allPrev?.filter((r) => !isSaving(r)) ?? null
  const net = sumOf(cur, 'income') - sumOf(cur, 'spend')

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
      { net, savedSpends: sumOf(all, 'spend') - sumOf(cur, 'spend') },
      scope.type === 'all',
      base,
    ),
    needsWants: buildNeedsWants({
      cur: all,
      prev: allPrev,
      goalSetAside: goalSetAsideIn(
        ledger.goalSetAsides,
        range,
        inScope,
        scope.type === 'all',
        base,
        rates,
      ),
      range,
      today,
      catalog,
      base,
    }),
    breakdown: {
      spend: buildCategoryBreakdown(cur, prev, 'spend', catalog, base),
      income: buildCategoryBreakdown(cur, prev, 'income', catalog, base),
    },
    largest: buildLargest(cur, catalog, ledger.merchantNames, base),
  }
}
