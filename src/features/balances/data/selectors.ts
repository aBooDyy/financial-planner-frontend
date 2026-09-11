import { convertMinor, formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { LocalBalanceNode } from '#/db/types'

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

export type CurrencyBreakdown = {
  currency: CurrencyCode
  color: string
  amountStr: string
  baseStr: string
  pct: number
  pctStr: string
  showBase: boolean
}

export type GroupBar = {
  id: string
  label: string
  color: string
  valueStr: string
  pct: number
}

export type BalancesView = {
  grandTotalStr: string
  walletCount: number
  groupCount: number
  currencyCount: number
  walletCountStr: string
  groupCountStr: string
  currencyCountStr: string
  rows: BalanceRow[]
  groupBars: GroupBar[]
  breakdown: CurrencyBreakdown[]
  // Total earmarked for goals across all wallets, in base currency, and what's left free.
  reservedTotal: number
  hasReserved: boolean
  reservedTotalStr: string
  availableTotalStr: string
}

type RatesMap = Partial<Record<string, number>>

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

export type ParentOption = { id: string; label: string }

/**
 * Groups a node may be nested into ("Place inside"), indented by depth. Excludes the node
 * being edited and its own descendants so a group can't be moved inside itself.
 */
export type WalletGroupOption = {
  // null label = wallets sitting at the root, outside any group.
  label: string | null
  wallets: { id: string; name: string }[]
}

/**
 * Wallets bucketed by the group that directly contains them, for a grouped picker.
 * Nested groups flatten into a "Parent › Child" path label; groups with no direct
 * wallet children are skipped so the list never shows an empty heading.
 */
export function walletGroupOptions(
  nodes: LocalBalanceNode[],
): WalletGroupOption[] {
  const live = nodes.filter((n) => n.deleted === 0)
  const children = childrenByParent(live)
  const groups: WalletGroupOption[] = []
  const walk = (parentId: string | null, label: string | null) => {
    const kids = children.get(parentId) ?? []
    const wallets = kids
      .filter((n) => n.kind === 'wallet')
      .map((n) => ({ id: n.id, name: n.name }))
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
  const live = nodes.filter((n) => n.deleted === 0)
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

export function buildBalancesView(
  nodes: LocalBalanceNode[],
  base: CurrencyCode,
  rates: RatesMap,
  // Signed minor-unit deltas per wallet (from the ledger), in each wallet's own currency.
  // Defaults to empty so callers without transactions get the plain stored balances.
  walletDeltas: Record<string, number> = {},
  // Goal reserves earmarked against each wallet, in the wallet's own currency (from
  // goals/data/reservations). Defaults to empty so callers without goals see no reserves.
  reservations: Record<string, WalletReservation[]> = {},
): BalancesView {
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

  // Flatten the visible tree (honoring collapse) and tally counts.
  const rows: BalanceRow[] = []
  const byCurrency = new Map<CurrencyCode, number>()
  let walletCount = 0
  let groupCount = 0

  const walk = (node: LocalBalanceNode, depth: number) => {
    if (node.kind === 'group') {
      groupCount += 1
      const kids = children.get(node.id) ?? []
      const groupReserved = reservedBase(node)
      const groupAvailable = baseTotal(node) - groupReserved
      rows.push({
        id: node.id,
        kind: 'group',
        depth,
        name: node.name,
        color: node.color,
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

    walletCount += 1
    const currency = node.currency ?? base
    const amount = effectiveAmount(node)
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount)
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

  // Top-level group/wallet bars for the hero stacked bar.
  const groupBars: GroupBar[] = roots
    .map((n) => ({
      id: n.id,
      label: n.name,
      color: n.color,
      value: baseTotal(n),
    }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((b) => ({
      id: b.id,
      label: b.label,
      color: b.color,
      valueStr: formatMoney(b.value, base),
      pct: grand > 0 ? (b.value / grand) * 100 : 0,
    }))

  // Multi-currency breakdown, largest base-value first.
  const PALETTE = ['#1F9D6B', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B']
  const breakdown: CurrencyBreakdown[] = [...byCurrency.entries()]
    .map(([currency, amount]) => {
      const baseVal = convertMinor(amount, currency, base, rates)
      return {
        currency,
        amount,
        baseVal,
        pct: grand > 0 ? (baseVal / grand) * 100 : 0,
      }
    })
    .sort((a, b) => b.baseVal - a.baseVal)
    .map((b, i) => ({
      currency: b.currency,
      color: PALETTE[i % PALETTE.length],
      amountStr: formatMoney(b.amount, b.currency),
      baseStr: `≈ ${formatMoney(b.baseVal, base)}`,
      pct: b.pct,
      pctStr: `${Math.round(b.pct)}%`,
      showBase: b.currency !== base,
    }))

  return {
    grandTotalStr: formatMoney(grand, base),
    walletCount,
    groupCount,
    currencyCount: byCurrency.size,
    walletCountStr: plural(walletCount, 'wallet', 'wallets'),
    groupCountStr: plural(groupCount, 'group', 'groups'),
    currencyCountStr: plural(byCurrency.size, 'currency', 'currencies'),
    rows,
    groupBars,
    breakdown,
    reservedTotal,
    hasReserved: reservedTotal > 0,
    reservedTotalStr: formatMoney(reservedTotal, base),
    availableTotalStr: formatMoney(grand - reservedTotal, base),
  }
}
