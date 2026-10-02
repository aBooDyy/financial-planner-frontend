import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { buildArchivedList } from '#/features/wallets/data/archivedList'
import { walletIdsUnder } from '#/features/wallets/data/heldMoney'
import { heldTotalStr } from '#/features/wallets/data/setAsideMoves'
import { readWalletDeltas } from '#/features/transactions/data/ledgerReads'
import { useStableRates } from '#/hooks/useStableRates'
import { usePreferencesStore } from '#/stores/preferences'

/**
 * The archived wallets and groups, with what each still holds and has set aside, for
 * Settings › Archived.
 */
export function useArchivedNodes() {
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const rateRows = useLiveQuery(() => db.exchangeRates.toArray())
  const settings = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const setAsideRows = useLiveQuery(() => db.setAsides.toArray())
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const rates = useStableRates(rateRows)
  const ratesReady = rateRows !== undefined
  const deltas = useLiveQuery(
    () => (ratesReady ? readWalletDeltas(rates) : undefined),
    [ratesReady, rates],
  )

  const base = settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY
  const nodes = (nodeRows ?? []).filter((n) => n.deleted === 0)
  const items = buildArchivedList(
    nodes,
    { deltas: deltas ?? {}, base, rates },
    dateFormat,
  )

  /** What the node's wallets hold set aside ("SR 1,900.00"), freed if it is deleted. */
  const heldStrOf = (id: string | null): string | null =>
    id
      ? heldTotalStr(setAsideRows ?? [], walletIdsUnder(nodes, id), base, rates)
      : null

  return {
    loading: nodeRows === undefined || deltas === undefined,
    items,
    heldStrOf,
  }
}
