import { useLiveQuery } from 'dexie-react-hooks'
import { readLedgerWindow } from '#/features/transactions/data/ledgerReads'
import type { LedgerWindow } from '#/features/transactions/data/ledgerReads'
import type { IsoPeriod } from '#/features/transactions/data/planning'

/**
 * The ledger rows the Spending views need for one period. While a new period loads, the
 * previous answer stays — tagged with the period it belongs to, so a caller building views
 * from it keeps showing that period rather than the new one computed over the wrong rows.
 */
export function useLedgerWindow(
  period: IsoPeriod,
  today: string,
): LedgerWindow | undefined {
  const { mode, start, end } = period
  return useLiveQuery(
    () => readLedgerWindow({ mode, start, end }, today),
    [mode, start, end, today],
  )
}
