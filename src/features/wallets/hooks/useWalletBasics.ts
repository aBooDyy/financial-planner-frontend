import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalExchangeRate } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { activeNodes } from '#/features/wallets/data/archive'
import { useStableRates } from '#/hooks/useStableRates'
import type { CurrencyCode } from '#/lib/currency'

const NO_RATE_ROWS: LocalExchangeRate[] = []

/**
 * The active wallets and groups, the base currency and the rates — no balances, so screens
 * that only name or pick a wallet (Settings) never read the ledger or the planner.
 */
export function useWalletBasics() {
  const nodes = useLiveQuery(() => db.balanceNodes.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const rates = useStableRates(rateRows)
  const base: CurrencyCode = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY

  return {
    base,
    rates,
    rateRows: rateRows ?? NO_RATE_ROWS,
    nodes: activeNodes((nodes ?? []).filter((n) => n.deleted === 0)),
  }
}
