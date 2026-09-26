import type { LocalBalanceNode } from '#/db/types'

type TreeNode = Pick<
  LocalBalanceNode,
  'id' | 'parentId' | 'archivedAt' | 'deleted'
>

export const isArchived = (node: Pick<LocalBalanceNode, 'archivedAt'>) =>
  Boolean(node.archivedAt)

/**
 * Every node an archive hides: the archived ones and everything beneath an archived group.
 * The walk up each ancestor chain is memoised and bounded, so a corrupt cycle ends it.
 */
export function hiddenByArchive(nodes: readonly TreeNode[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const memo = new Map<string, boolean>()
  const hidden = (id: string | null, hops: number): boolean => {
    if (id === null || hops > nodes.length) return false
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    const node = byId.get(id)
    const result =
      node !== undefined &&
      (isArchived(node) || hidden(node.parentId, hops + 1))
    memo.set(id, result)
    return result
  }
  return new Set(nodes.filter((n) => hidden(n.id, 0)).map((n) => n.id))
}

/** The live tree: not deleted, not archived, not inside an archived group. */
export function activeNodes<TNode extends TreeNode>(
  nodes: readonly TNode[],
): TNode[] {
  const live = nodes.filter((n) => n.deleted === 0)
  const hidden = hiddenByArchive(live)
  return live.filter((n) => !hidden.has(n.id))
}

/** True when some group above `node` is archived too, so restoring it alone keeps it hidden. */
export function hasArchivedAncestor(
  nodes: readonly TreeNode[],
  node: TreeNode,
): boolean {
  return node.parentId !== null && hiddenByArchive(nodes).has(node.parentId)
}

/** `rootId` and every node beneath it. */
export function subtreeIds(
  nodes: readonly Pick<LocalBalanceNode, 'id' | 'parentId'>[],
  rootId: string,
): string[] {
  const children = new Map<string | null, string[]>()
  for (const n of nodes) {
    const list = children.get(n.parentId) ?? []
    list.push(n.id)
    children.set(n.parentId, list)
  }
  const found: string[] = []
  const seen = new Set<string>()
  const pending = [rootId]
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    found.push(id)
    pending.push(...(children.get(id) ?? []))
  }
  return found
}
