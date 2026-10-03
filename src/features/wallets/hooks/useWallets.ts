import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { walletSetAsides } from '#/features/setAsides/data/totals'
import { useWalletDeltas } from '#/features/transactions/hooks/useWalletDeltas'
import { activeNodes, isArchived } from '#/features/wallets/data/archive'
import { buildWalletsView } from '#/features/wallets/data/selectors'

const NONE: Record<string, never> = {}

/**
 * The Wallets view, derived from the planner's shared read (wallets, settings, rates, bills,
 * goals, set-asides) and the shared ledger totals — the snapshot Safe to spend and Coming up
 * read too, so the page reads no table twice and its figures agree.
 *
 * `loading` is true until the nodes are known (the tree can draw); `balancesLoading` until
 * every input a figure derives from has landed. Until then the view carries the tree with no
 * deltas and no set-asides, and its figures must not be shown.
 */
export function useWallets() {
  const { inputs, nodes, loading, nodesLoading } = usePlannedData()
  const { base, rates, goals, bills, setAsides } = inputs
  const walletDeltas = useWalletDeltas(rates)

  const balancesLoading = loading || walletDeltas === undefined
  // Transactions are the ledger: their signed deltas, summed in the totals, fold into balances.
  const deltas = balancesLoading ? NONE : walletDeltas
  // Set-asides earmark part of each wallet until they are released.
  const setAsideLines = balancesLoading
    ? NONE
    : walletSetAsides(setAsides, goals, bills, nodes, rates)
  // Archived nodes keep their ledger and earmarks but leave the tree and its totals.
  const active = activeNodes(nodes)

  return {
    loading: nodesLoading,
    balancesLoading,
    base,
    rates,
    nodes: active,
    archivedCount: nodes.filter(isArchived).length,
    deltas,
    setAsideLines,
    /** Every live set-aside row, held and released. */
    setAsideRows: setAsides,
    view: buildWalletsView(active, base, rates, deltas, setAsideLines),
  }
}
