import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/balances/constants'
import { buildArchivedList } from '#/features/balances/data/archivedList'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { useMergedRates } from '#/lib/config/rates'
import { usePreferencesStore } from '#/stores/preferences'

/** The archived wallets and groups, with what each still holds, for Settings › Archived. */
export function useArchivedNodes() {
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const txnRows = useLiveQuery(() => db.transactions.toArray())
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const rates = useMergedRates(rateRows ?? [])

  const base = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  const nodes = (nodeRows ?? []).filter((n) => n.deleted === 0)
  const deltas = walletDeltas(nodes, txnRows ?? [], rates)
  const items = buildArchivedList(nodes, { deltas, base, rates }, dateFormat)

  return { loading: nodeRows === undefined, items }
}
