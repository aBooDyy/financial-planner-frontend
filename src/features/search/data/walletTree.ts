import type { LocalBalanceNode } from '#/db/types'
import { activeNodes } from '#/features/wallets/data/archive'

export type TreeWallet = {
  wallet: LocalBalanceNode
  /** The group it sits directly in; null for a wallet in no group. */
  group: LocalBalanceNode | null
}

/**
 * The live wallets in the order the Wallets tree lists them: each top-level group's subtree
 * first, then the wallets in no group.
 */
export function treeWallets(
  nodes: ReadonlyArray<LocalBalanceNode>,
): TreeWallet[] {
  const active = activeNodes(nodes)
  const byId = new Map(active.map((n) => [n.id, n]))
  const children = new Map<string | null, LocalBalanceNode[]>()
  for (const n of active) {
    const list = children.get(n.parentId) ?? []
    list.push(n)
    children.set(n.parentId, list)
  }
  for (const list of children.values())
    list.sort((a, b) => a.position - b.position)

  const walk = (n: LocalBalanceNode): LocalBalanceNode[] =>
    n.kind === 'wallet' ? [n] : (children.get(n.id) ?? []).flatMap(walk)
  const roots = children.get(null) ?? []
  const ordered = [
    ...roots.filter((n) => n.kind === 'group').flatMap(walk),
    ...roots.filter((n) => n.kind === 'wallet'),
  ]
  return ordered.map((wallet) => ({
    wallet,
    group: wallet.parentId ? (byId.get(wallet.parentId) ?? null) : null,
  }))
}
