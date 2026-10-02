/**
 * Set-asides held in a wallet that is leaving (03 §6): archived wallets never hold set-asides,
 * so archiving moves them to another wallet or frees them; deleting frees them, as the server
 * does on delete. Each is one release or move batch.
 */
import { db } from '#/db/db'
import type { LocalBalanceNode, LocalSetAside } from '#/db/types'
import {
  moveSetAsides,
  releaseSetAsides,
} from '#/features/setAsides/data/batches'
import { subtreeIds } from './archive'
import { heldIn } from './setAsideMoves'

/** The wallets a node stands for: itself, or every wallet under a group. */
export function walletIdsUnder(
  nodes: ReadonlyArray<Pick<LocalBalanceNode, 'id' | 'parentId' | 'kind'>>,
  id: string,
): Set<string> {
  const kinds = new Map(nodes.map((n) => [n.id, n.kind]))
  return new Set(
    subtreeIds([...nodes], id).filter((n) => kinds.get(n) === 'wallet'),
  )
}

async function heldUnder(id: string): Promise<LocalSetAside[]> {
  const [nodes, rows] = await Promise.all([
    db.balanceNodes.toArray(),
    db.setAsides.toArray(),
  ])
  const live = nodes.filter((n) => n.deleted === 0)
  return heldIn(rows, walletIdsUnder(live, id))
}

/** Release everything set aside in the node's wallets; their money is free again. */
export async function freeSetAsidesUnder(id: string): Promise<void> {
  const rows = await heldUnder(id)
  await releaseSetAsides(rows.map((a) => ({ id: a.id })))
}

/** Move everything set aside in the node's wallets to another wallet, owners unchanged. */
export async function moveSetAsidesOutOf(
  id: string,
  toWalletId: string,
): Promise<void> {
  const rows = await heldUnder(id)
  await moveSetAsides(
    rows.map((a) => ({ id: a.id, to: { walletId: toWalletId } })),
  )
}
