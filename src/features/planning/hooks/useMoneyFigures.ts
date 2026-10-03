import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { balanceFigures } from '#/features/planning/data/balances'
import type { BalanceFigures } from '#/features/planning/data/balances'
import { safeToSpend } from '#/features/planning/data/safeToSpend'
import type { SafeToSpend } from '#/features/planning/data/safeToSpend'
import { useWalletDeltas } from '#/features/transactions/hooks/useWalletDeltas'

export type MoneyFiguresView = {
  /** True until the ledger and every planning input have been read. */
  loading: boolean
  figures: BalanceFigures
  safe: SafeToSpend
}

/**
 * Balance · Set aside · Free to spend for every wallet, group and the header, and Safe to
 * spend — the Wallets page's numbers. Reads the ledger's running totals (never the whole
 * ledger) on top of the planner's shared read.
 */
export function useMoneyFigures(): MoneyFiguresView {
  const data = usePlannedData()
  const { inputs, state, nodes, today } = data
  const deltas = useWalletDeltas(inputs.rates)
  return useMemo(() => {
    const figures = balanceFigures({
      nodes,
      walletDeltas: deltas ?? {},
      setAsides: inputs.setAsides,
      goals: inputs.goals,
      bills: inputs.bills,
      base: inputs.base,
      rates: inputs.rates,
    })
    return {
      loading: data.loading || deltas === undefined,
      figures,
      safe: safeToSpend({
        header: figures.header,
        planned: inputs.planned,
        index: state.index,
        setAsides: inputs.setAsides,
        bills: inputs.bills,
        goals: inputs.goals,
        settings: inputs.settings,
        calendar: state.funding.calendar,
        today,
        base: inputs.base,
        rates: inputs.rates,
      }),
    }
  }, [data.loading, inputs, state, nodes, today, deltas])
}
