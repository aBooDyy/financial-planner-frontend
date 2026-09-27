import { useMemo } from 'react'
import { walletReservations } from '#/features/goals/data/reservations'
import { dateOf } from '#/features/planned/data/dates'
import { buildForecast } from '#/features/planned/data/forecast'
import type { ForecastView } from '#/features/planned/data/forecast'
import { buildHeaded } from '#/features/planned/data/headed'
import type { HeadedView } from '#/features/planned/data/headed'
import type { PlannedListView } from '#/features/planned/data/views'
import { activeNodes } from '#/features/wallets/data/archive'
import { convertMinor } from '#/lib/currency'
import { usePlannedData } from './usePlannedData'

export type PlannedOutlook = {
  /** `null` until both the balances and the planned rows land. */
  forecast: ForecastView | null
  /** `null` until the planned rows land. */
  headed: HeadedView | null
}

/**
 * The Planned tab's rail over the list the tab already built: the balance forecast and where
 * planned income is headed. `balance` is every live account's balance in base, or `null`
 * while it loads.
 */
export function usePlannedOutlook(
  list: PlannedListView,
  balance: number | null,
): PlannedOutlook {
  const data = usePlannedData()
  const { inputs, nodes, today, loading } = data
  const { due, next, later } = list
  const rows = useMemo(() => [...due, ...next, ...later], [due, next, later])

  // Goal money in live wallets, in base — what the forecast warns before dipping into.
  const reserved = useMemo(() => {
    if (loading) return 0
    const byWallet = walletReservations(
      inputs.allocations,
      inputs.goals,
      nodes,
      inputs.rates,
      inputs.txns,
      dateOf(today),
      inputs.planned,
    )
    return activeNodes(nodes).reduce(
      (sum, n) =>
        sum +
        (byWallet[n.id] ?? []).reduce(
          (s, line) =>
            s +
            convertMinor(
              line.amount,
              n.currency ?? inputs.base,
              inputs.base,
              inputs.rates,
            ),
          0,
        ),
      0,
    )
  }, [loading, inputs, nodes, today])

  const headed = useMemo(
    () =>
      loading
        ? null
        : buildHeaded({ rows, base: inputs.base, rates: inputs.rates, today }),
    [loading, rows, inputs.base, inputs.rates, today],
  )

  const forecast = useMemo(
    () =>
      loading || balance === null
        ? null
        : buildForecast({
            rows,
            balance,
            reserved,
            base: inputs.base,
            rates: inputs.rates,
            today,
          }),
    [loading, balance, rows, reserved, inputs.base, inputs.rates, today],
  )

  return { forecast, headed }
}
