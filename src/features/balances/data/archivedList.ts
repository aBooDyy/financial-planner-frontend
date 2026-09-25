import type { LocalBalanceNode } from '#/db/types'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import type { IconId } from '#/lib/icons/catalog.gen'
import { hiddenByArchive, isArchived, subtreeIds } from './archive'

/** What the archive confirmation needs to say about the node it takes away. */
export type ArchiveTarget = {
  id: string
  kind: LocalBalanceNode['kind']
  name: string
  /** Wallets that leave with a group; 0 for a wallet. */
  walletCount: number
  /** The money that stops counting toward the total, or null when there is none. */
  holdingStr: string | null
}

export type ArchivedItem = {
  id: string
  kind: LocalBalanceNode['kind']
  name: string
  color: string
  icon: IconId
  archivedStr: string
  /** Where it sat: its parent group's name, or null at the top level. */
  placeName: string | null
  /** Its group is archived too, so a restore brings it back at the top level. */
  stranded: boolean
  walletCount: number
  balanceStr: string
}

type Money = {
  deltas: Record<string, number>
  base: CurrencyCode
  rates: RatesMap
}

const walletBalance = (w: LocalBalanceNode, deltas: Record<string, number>) =>
  (w.amount ?? 0) + (deltas[w.id] ?? 0)

const walletsUnder = (nodes: LocalBalanceNode[], rootId: string) => {
  const ids = new Set(subtreeIds(nodes, rootId))
  return nodes.filter((n) => n.kind === 'wallet' && ids.has(n.id))
}

/** A wallet in its own currency; a group as its wallets' total in the base currency. */
function balanceOf(
  node: LocalBalanceNode,
  wallets: LocalBalanceNode[],
  { deltas, base, rates }: Money,
): { minor: number; str: string } {
  if (node.kind === 'wallet') {
    const minor = walletBalance(node, deltas)
    return { minor, str: formatMoney(minor, node.currency ?? base) }
  }
  const minor = wallets.reduce(
    (sum, w) =>
      sum +
      convertMinor(walletBalance(w, deltas), w.currency ?? base, base, rates),
    0,
  )
  return { minor, str: formatMoney(minor, base) }
}

export function archiveTarget(
  nodes: LocalBalanceNode[],
  id: string,
  money: Money,
): ArchiveTarget | null {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  const wallets = walletsUnder(nodes, id)
  const held = wallets.some((w) => walletBalance(w, money.deltas) !== 0)
  return {
    id,
    kind: node.kind,
    name: node.name,
    walletCount: node.kind === 'group' ? wallets.length : 0,
    holdingStr: held ? balanceOf(node, wallets, money).str : null,
  }
}

/** Every archived node, most recently archived first. `nodes` is the live (undeleted) set. */
export function buildArchivedList(
  nodes: LocalBalanceNode[],
  money: Money,
  dateFormat: DateFormat,
): ArchivedItem[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const hidden = hiddenByArchive(nodes)
  return nodes
    .filter(isArchived)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
    .map((node) => {
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      const wallets = walletsUnder(nodes, node.id)
      return {
        id: node.id,
        kind: node.kind,
        name: node.name,
        color: node.color,
        icon: iconIdOr(
          node.icon,
          node.kind === 'wallet' ? WALLET_ICON : GROUP_ICON,
        ),
        archivedStr: formatDate(new Date(node.archivedAt ?? ''), dateFormat),
        placeName: parent?.name ?? null,
        stranded: parent !== undefined && hidden.has(parent.id),
        walletCount: node.kind === 'group' ? wallets.length : 0,
        balanceStr: balanceOf(node, wallets, money).str,
      }
    })
}
