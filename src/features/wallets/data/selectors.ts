import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney } from '#/lib/currency'
import { formatShare } from '#/lib/percent'
import type { CurrencyCode } from '#/lib/currency'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import type { IconId } from '#/lib/icons/catalog.gen'
import type { LocalBalanceNode } from '#/db/types'
import { activeNodes } from './archive'

// One goal's claim on a wallet, in the wallet's currency (built by goals/data/reservations).
export type WalletReservation = {
  goalId: string
  goalName: string
  color: string
  amount: number
}

// A reserve line on a wallet row, ready to render.
export type ReservationRow = {
  goalId: string
  goalName: string
  color: string
  amountStr: string
}

export type BalanceRow = {
  id: string
  kind: 'wallet' | 'group'
  depth: number
  name: string
  color: string
  // Ready to render: a node with no icon, or one the pack no longer defines, resolves to
  // its kind's default here so no row is ever iconless.
  icon: IconId
  note: string | null
  collapsed: boolean
  childCount: number
  childCountStr: string
  amountStr: string
  isForeign: boolean
  baseStr: string
  subtotalStr: string
  // Wallet earmarks: part of the balance reserved for goals, and what's left available. A
  // group rolls up its descendant wallets' reserved/available. `reservations` is the per-goal
  // breakdown shown when a wallet row is expanded. Over-reserving is allowed: `available` then
  // goes negative and `overReserved` is set (rendered in red).
  reserved: number
  available: number
  hasReserved: boolean
  overReserved: boolean
  reservedStr: string
  availableStr: string
  reservations: ReservationRow[]
}

export type GroupBar = {
  id: string
  label: string
  color: string
  valueStr: string
  pct: number
  pctStr: string
}

export type WalletsView = {
  grandTotalStr: string
  walletCount: number
  groupCount: number
  currencyCount: number
  walletCountStr: string
  groupCountStr: string
  currencyCountStr: string
  rows: BalanceRow[]
  groupBars: GroupBar[]
  // Total earmarked for goals across all wallets, in base currency, and what's left free.
  reservedTotal: number
  hasReserved: boolean
  reservedTotalStr: string
  availableTotalStr: string
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

function childrenByParent(
  nodes: LocalBalanceNode[],
): Map<string | null, LocalBalanceNode[]> {
  const map = new Map<string | null, LocalBalanceNode[]>()
  for (const n of nodes) {
    const list = map.get(n.parentId) ?? []
    list.push(n)
    map.set(n.parentId, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position)
  return map
}

/**
 * The currencies the user actually has money in (plus the base and any rate they edited).
 * The currency table is ~155 codes now, so anything that lists rates lists these instead.
 */
export function heldCurrencies(
  base: CurrencyCode,
  sources: ReadonlyArray<ReadonlyArray<{ currency: CurrencyCode | null }>>,
): CurrencyCode[] {
  const held = new Set<CurrencyCode>()
  for (const rows of sources) {
    for (const row of rows) if (row.currency) held.add(row.currency)
  }
  held.delete(base)
  return [base, ...[...held].sort()]
}

export type ParentOption = { id: string; label: string }

/**
 * Groups a node may be nested into ("Place inside"), indented by depth. Excludes the node
 * being edited and its own descendants so a group can't be moved inside itself.
 */
export type WalletGroupOption = {
  // null label = wallets sitting at the root, outside any group.
  label: string | null
  wallets: { id: string; name: string; icon?: IconId; color?: string }[]
}

/**
 * Wallets bucketed by the group that directly contains them, for a grouped picker.
 * Nested groups flatten into a "Parent › Child" path label; groups with no direct
 * wallet children are skipped so the list never shows an empty heading.
 */
export function walletGroupOptions(
  nodes: LocalBalanceNode[],
): WalletGroupOption[] {
  const live = activeNodes(nodes)
  const children = childrenByParent(live)
  const groups: WalletGroupOption[] = []
  const walk = (parentId: string | null, label: string | null) => {
    const kids = children.get(parentId) ?? []
    const wallets = kids
      .filter((n) => n.kind === 'wallet')
      .map((n) => ({
        id: n.id,
        name: n.name,
        icon: iconIdOr(n.icon, WALLET_ICON),
        color: n.color,
      }))
    if (wallets.length > 0) groups.push({ label, wallets })
    for (const group of kids.filter((n) => n.kind === 'group')) {
      walk(group.id, label ? `${label} › ${group.name}` : group.name)
    }
  }
  walk(null, null)
  return groups
}

export function groupParentOptions(
  nodes: LocalBalanceNode[],
  excludeId: string | null,
): ParentOption[] {
  const live = activeNodes(nodes)
  const children = childrenByParent(live)
  const options: ParentOption[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const node of children.get(parentId) ?? []) {
      if (node.kind !== 'group') continue
      if (node.id === excludeId) continue
      options.push({
        id: node.id,
        label: `${'   '.repeat(depth)}↳ ${node.name}`,
      })
      walk(node.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

export function buildWalletsView(
  nodes: LocalBalanceNode[],
  base: CurrencyCode,
  rates: RatesMap,
  // Signed minor-unit deltas per wallet (from the ledger), in each wallet's own currency.
  // Defaults to empty so callers without transactions get the plain stored balances.
  walletDeltas: Record<string, number> = {},
  // Goal reserves earmarked against each wallet, in the wallet's own currency (from
  // goals/data/reservations). Defaults to empty so callers without goals see no reserves.
  reservations: Record<string, WalletReservation[]> = {},
): WalletsView {
  const live = nodes.filter((n) => n.deleted === 0)
  const children = childrenByParent(live)

  // A wallet's live balance = its stored opening `amount` plus the transactions posted to it.
  const effectiveAmount = (node: LocalBalanceNode): number =>
    (node.amount ?? 0) + (walletDeltas[node.id] ?? 0)

  // What a wallet has earmarked for goals, in its own currency. Not capped at the balance:
  // over-reserving is allowed and shows up as a negative available figure.
  const walletReserved = (node: LocalBalanceNode): number => {
    const lines = reservations[node.id] ?? []
    return Math.max(
      0,
      lines.reduce((acc, l) => acc + l.amount, 0),
    )
  }

  const baseTotal = (node: LocalBalanceNode): number => {
    if (node.kind === 'wallet') {
      return convertMinor(
        effectiveAmount(node),
        node.currency ?? base,
        base,
        rates,
      )
    }
    return (children.get(node.id) ?? []).reduce(
      (sum, child) => sum + baseTotal(child),
      0,
    )
  }

  // Reserved (base currency) rolled up across a node's descendant wallets.
  const reservedBase = (node: LocalBalanceNode): number => {
    if (node.kind === 'wallet') {
      return convertMinor(
        walletReserved(node),
        node.currency ?? base,
        base,
        rates,
      )
    }
    return (children.get(node.id) ?? []).reduce(
      (sum, child) => sum + reservedBase(child),
      0,
    )
  }

  const roots = children.get(null) ?? []
  const grand = roots.reduce((sum, n) => sum + baseTotal(n), 0)
  const reservedTotal = roots.reduce((sum, n) => sum + reservedBase(n), 0)

  // Totals and counts describe everything the user owns, so they tally the whole tree.
  // Collapsing a group only hides rows below; it must never change these figures.
  const currencies = new Set<CurrencyCode>()
  let walletCount = 0
  let groupCount = 0

  const tally = (node: LocalBalanceNode) => {
    if (node.kind === 'group') {
      groupCount += 1
      for (const child of children.get(node.id) ?? []) tally(child)
      return
    }
    walletCount += 1
    currencies.add(node.currency ?? base)
  }
  for (const root of roots) tally(root)

  // Flatten the tree into the rows that are actually visible (honoring collapse).
  const rows: BalanceRow[] = []

  const walk = (node: LocalBalanceNode, depth: number) => {
    if (node.kind === 'group') {
      const kids = children.get(node.id) ?? []
      const groupReserved = reservedBase(node)
      const groupAvailable = baseTotal(node) - groupReserved
      rows.push({
        id: node.id,
        kind: 'group',
        depth,
        name: node.name,
        color: node.color,
        icon: iconIdOr(node.icon, GROUP_ICON),
        note: node.note,
        collapsed: node.collapsed,
        childCount: kids.length,
        childCountStr: `(${kids.length})`,
        amountStr: '',
        isForeign: false,
        baseStr: '',
        subtotalStr: formatMoney(baseTotal(node), base),
        reserved: groupReserved,
        available: groupAvailable,
        hasReserved: groupReserved > 0,
        overReserved: groupAvailable < -0.5,
        reservedStr: formatMoney(groupReserved, base),
        availableStr: formatMoney(groupAvailable, base),
        reservations: [],
      })
      if (!node.collapsed) for (const child of kids) walk(child, depth + 1)
      return
    }

    const currency = node.currency ?? base
    const amount = effectiveAmount(node)
    const reserved = walletReserved(node)
    const available = amount - reserved
    const reservationRows: ReservationRow[] = (reservations[node.id] ?? []).map(
      (l) => ({
        goalId: l.goalId,
        goalName: l.goalName,
        color: l.color,
        amountStr: formatMoney(l.amount, currency),
      }),
    )
    rows.push({
      id: node.id,
      kind: 'wallet',
      depth,
      name: node.name,
      color: node.color,
      icon: iconIdOr(node.icon, WALLET_ICON),
      note: node.note,
      collapsed: false,
      childCount: 0,
      childCountStr: '',
      amountStr: formatMoney(amount, currency),
      isForeign: currency !== base,
      baseStr: `≈ ${formatMoney(convertMinor(amount, currency, base, rates), base)}`,
      subtotalStr: '',
      reserved,
      available,
      hasReserved: reserved > 0,
      overReserved: available < -0.5,
      reservedStr: formatMoney(reserved, currency),
      availableStr: formatMoney(available, currency),
      reservations: reservationRows,
    })
  }
  for (const root of roots) walk(root, 0)

  // Top-level group/wallet bars for the hero stacked bar. Shares are over the positive
  // nodes shown, not the netted total, so a negative node can't push them past 100%.
  const positiveRoots = roots
    .map((n) => ({
      id: n.id,
      label: n.name,
      color: n.color,
      value: baseTotal(n),
    }))
    .filter((b) => b.value > 0)
  const barTotal = positiveRoots.reduce((sum, b) => sum + b.value, 0)
  const groupBars: GroupBar[] = positiveRoots
    .sort((a, b) => b.value - a.value)
    .map((b) => {
      const pct = (b.value / barTotal) * 100
      return {
        id: b.id,
        label: b.label,
        color: b.color,
        valueStr: formatMoney(b.value, base),
        pct,
        pctStr: `${formatShare(pct)} of total`,
      }
    })

  return {
    grandTotalStr: formatMoney(grand, base),
    walletCount,
    groupCount,
    currencyCount: currencies.size,
    walletCountStr: plural(walletCount, 'wallet', 'wallets'),
    groupCountStr: plural(groupCount, 'group', 'groups'),
    currencyCountStr: plural(currencies.size, 'currency', 'currencies'),
    rows,
    groupBars,
    reservedTotal,
    hasReserved: reservedTotal > 0,
    reservedTotalStr: formatMoney(reservedTotal, base),
    availableTotalStr: formatMoney(grand - reservedTotal, base),
  }
}
