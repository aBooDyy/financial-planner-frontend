import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfToday } from '#/features/goals/data/planning'
import { dateOf, isoOf } from '#/features/planned/data/dates'
import { readLedgerSince } from '#/features/transactions/data/ledgerReads'
import {
  buildMonthlyFlow,
  flowWindowStart,
} from '#/features/wallets/data/monthlyFlow'
import type { MonthlyFlowView } from '#/features/wallets/data/monthlyFlow'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Money in and out over the last six months. Reads only the rows dated inside that window;
 * `null` until they, the rates and the base currency have landed.
 */
export function useMonthlyFlow(
  base: CurrencyCode,
  rates: RatesMap,
  ready: boolean,
): MonthlyFlowView | null {
  const today = isoOf(startOfToday())
  const from = flowWindowStart(dateOf(today))
  const rows = useLiveQuery(() => readLedgerSince(from), [from])
  return useMemo(
    () =>
      ready && rows ? buildMonthlyFlow(rows, base, rates, dateOf(today)) : null,
    [ready, rows, base, rates, today],
  )
}
