import { useLiveQuery } from 'dexie-react-hooks'
import type { RangeMode } from '#/features/transactions/constants'
import { readLedgerWindow } from '#/features/transactions/data/ledgerReads'
import type { LedgerWindow } from '#/features/transactions/data/ledgerReads'

/**
 * The ledger rows the Spending views need for one period. While a new period loads, the
 * previous answer stays — tagged with the period it belongs to, so a caller building views
 * from it keeps showing that period rather than the new one computed over the wrong rows.
 */
export function useLedgerWindow(
  anchor: string,
  mode: RangeMode,
  today: string,
): LedgerWindow | undefined {
  return useLiveQuery(
    () => readLedgerWindow(anchor, mode, today),
    [anchor, mode, today],
  )
}
