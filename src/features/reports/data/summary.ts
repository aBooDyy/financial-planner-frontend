import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { amountDelta, pctDelta, signedMoney } from './delta'
import type { Delta } from './delta'
import { sumOf } from './flowRows'
import type { FlowRow } from './flowRows'

export type SummaryStat = {
  amountStr: string
  /** Null with no comparison. */
  delta: Delta | null
}

export type SummaryView = {
  income: SummaryStat
  spending: SummaryStat
  net: SummaryStat & { label: string; positive: boolean }
  /** "vs Oct 1 – Mar 31, 2026", or null with no comparison. */
  vs: string | null
}

function netLabel(net: number, income: number): string {
  if (income <= 0) return 'Net'
  if (net < 0) return 'Net · spent more than earned'
  return `Net · saved ${Math.round((net / income) * 100)}% of income`
}

/** Income, spending and what was left over, each against the comparison period. */
export function buildSummary(
  cur: ReadonlyArray<FlowRow>,
  prev: ReadonlyArray<FlowRow> | null,
  compareCaption: string | null,
  base: CurrencyCode,
): SummaryView {
  const income = sumOf(cur, 'income')
  const spending = sumOf(cur, 'spend')
  const net = income - spending
  const pIncome = prev ? sumOf(prev, 'income') : 0
  const pSpending = prev ? sumOf(prev, 'spend') : 0
  return {
    income: {
      amountStr: formatMoneyRounded(income, base),
      delta: prev ? pctDelta(income, pIncome, true) : null,
    },
    spending: {
      amountStr: formatMoneyRounded(spending, base),
      delta: prev ? pctDelta(spending, pSpending, false) : null,
    },
    net: {
      label: netLabel(net, income),
      amountStr: signedMoney(net, base),
      positive: net >= 0,
      delta: prev ? amountDelta(net, pIncome - pSpending, base) : null,
    },
    vs: prev && compareCaption ? `vs ${compareCaption}` : null,
  }
}
