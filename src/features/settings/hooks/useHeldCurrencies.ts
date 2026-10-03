import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalExchangeRate } from '#/db/types'
import { readLedgerCurrencies } from '#/features/transactions/data/ledgerReads'
import { heldCurrencies } from '#/features/wallets/data/selectors'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Every currency the user holds anything in — wallets, bills, goals, set-asides, ledger rows
 * (deleted ones included) and rate rows — with the base first.
 */
export function useHeldCurrencies(
  base: CurrencyCode,
  rateRows: ReadonlyArray<LocalExchangeRate>,
): CurrencyCode[] {
  const read = useLiveQuery(async () => {
    const [nodes, goals, bills, setAsides, ledger] = await Promise.all([
      db.balanceNodes.toArray(),
      db.goals.toArray(),
      db.bills.toArray(),
      db.setAsides.toArray(),
      readLedgerCurrencies(),
    ])
    return [
      nodes.filter((n) => n.deleted === 0),
      goals.filter((g) => g.deleted === 0),
      bills.filter((b) => b.deleted === 0),
      ledger.map((currency) => ({ currency })),
      setAsides,
    ]
  })
  return useMemo(
    () => heldCurrencies(base, [...(read ?? []), rateRows]),
    [base, read, rateRows],
  )
}
