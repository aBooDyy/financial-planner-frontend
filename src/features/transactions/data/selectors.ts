import { convertMinor, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatShare } from '#/lib/percent'
import { DEFAULT_DATE_FORMAT, formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalGoal,
  LocalGoalAllocation,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { FREQUENCIES } from '#/features/goals/constants'
import type { AdjustmentType, TxType } from '#/features/transactions/api/types'
import { isAdjustment, isCashflow } from '#/features/transactions/api/types'
import { AMBER, AT_RISK_RATIO, RED } from '#/features/transactions/constants'
import type { RangeMode } from '#/features/transactions/constants'
import type { DateWindow } from './planning'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { liveBalancesFrom } from './ledger'
import { activeNodes } from '#/features/wallets/data/archive'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import type { IconId } from '#/lib/icons/catalog.gen'
import {
  addDays,
  budgetWindow,
  dayKey,
  fmtK,
  fmtMonth,
  fmtMonthShort,
  fmtShort,
  inWindow,
  midnight,
  monthKey,
  monthlyFactor,
  parseISO,
  relFuture,
  sameDay,
  sameMonth,
  startOfWeek,
  windowOf,
} from './planning'

/** The header caption for a range: "2026", "June 2026", "Jun 1 – Jun 7" or a single date. */
function rangeLabel(
  anchor: Date,
  mode: RangeMode,
  win: DateWindow,
  dateFormat: DateFormat,
): string {
  if (mode === 'day') return formatDate(anchor, dateFormat)
  if (mode === 'week') return `${fmtShort(win.start)} – ${fmtShort(win.end)}`
  if (mode === 'year') return String(anchor.getFullYear())
  return fmtMonth(anchor)
}

/** The caption for the period on screen, as the hero and the donut head it. */
export const periodCaption = (
  anchor: Date,
  mode: RangeMode,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): string => rangeLabel(anchor, mode, windowOf(anchor, mode), dateFormat)

type RatesMap = Partial<Record<string, number>>

/** One ticked account in the filter; a group covers every wallet beneath it. */
export type AccountPick =
  | { type: 'wallet'; id: string }
  | { type: 'group'; id: string }

/** Everything, one account, or — once two or more are ticked — any of them. */
export type Scope =
  | { type: 'all' }
  | AccountPick
  | { type: 'accounts'; picks: AccountPick[] }

export type SpendingData = {
  txns: LocalTransaction[]
  budgets: LocalBudget[]
  recurrings: LocalRecurring[]
  nodes: LocalBalanceNode[]
  base: CurrencyCode
  rates: RatesMap
  /** Goal reservations — listed in Activity as "Set aside" rows, never counted in a total. */
  allocations?: ReadonlyArray<LocalGoalAllocation>
  /** Names the goal a set-aside row belongs to. */
  goals?: ReadonlyArray<LocalGoal>
}

/** Everything the selectors read except the ledger rows. */
export type SpendingInputs = Omit<SpendingData, 'txns'>

// --- Scope helpers -------------------------------------------------------------------

/** For each wallet, the set of its ancestor group ids (so group scope can match descendants). */
function ancestorGroups(nodes: LocalBalanceNode[]): Map<string, Set<string>> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, Set<string>>()
  for (const n of nodes) {
    if (n.kind !== 'wallet') continue
    const groups = new Set<string>()
    let cursor = n.parentId
    let guard = 0
    while (cursor && guard < 64) {
      groups.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
      guard += 1
    }
    out.set(n.id, groups)
  }
  return out
}

function walletMatcher(
  scope: Scope,
  nodes: LocalBalanceNode[],
): (walletId: string) => boolean {
  if (scope.type === 'all') return () => true
  const picks = picksOf(scope)
  const wallets = new Set(
    picks.filter((p) => p.type === 'wallet').map((p) => p.id),
  )
  const groupIds = picks.filter((p) => p.type === 'group').map((p) => p.id)
  const ancestors = groupIds.length > 0 ? ancestorGroups(nodes) : null
  return (id) =>
    wallets.has(id) || groupIds.some((g) => ancestors?.get(id)?.has(g) ?? false)
}

export type ScopeOption = {
  value: string
  kind: 'all' | 'group' | 'wallet'
  name: string
  amountStr: string
  color: string | null
  icon: IconId | null
  /** Nesting under its group, for indentation; 0 for a top-level group or wallet. */
  depth: number
}

/** A filter option, whose balance in the base currency lets several picks be summed. */
export type FilterOption = ScopeOption & { baseMinor: number }

export type ScopeSection<TOption extends ScopeOption = ScopeOption> = {
  /** Heading above the section, or null when the options speak for themselves. */
  label: string | null
  options: TOption[]
}

/**
 * The account filter, shaped like the Wallets tree: everything, then one section per
 * top-level group with its wallets and subgroups nested beneath, then the wallets in no
 * group. Archived accounts are left out. `deltas` are `walletDeltas` over the whole ledger,
 * since a balance is never a window's sum.
 */
export function scopeSections(
  data: Pick<SpendingData, 'nodes' | 'base' | 'rates'>,
  deltas: Record<string, number>,
): ScopeSection<FilterOption>[] {
  const { nodes, base, rates } = data
  const balances = liveBalancesFrom(nodes, deltas)
  const active = activeNodes(nodes)
  const children = new Map<string | null, LocalBalanceNode[]>()
  for (const n of active) {
    const list = children.get(n.parentId) ?? []
    list.push(n)
    children.set(n.parentId, list)
  }
  for (const list of children.values())
    list.sort((a, b) => a.position - b.position)

  const inBase = (w: LocalBalanceNode): number =>
    convertMinor(balances[w.id] ?? 0, w.currency ?? base, base, rates)
  const baseTotal = (id: string | null): number =>
    (children.get(id) ?? []).reduce(
      (sum, n) => sum + (n.kind === 'wallet' ? inBase(n) : baseTotal(n.id)),
      0,
    )

  const option = (n: LocalBalanceNode, depth: number): FilterOption =>
    n.kind === 'wallet'
      ? {
          value: `wallet:${n.id}`,
          kind: 'wallet',
          name: n.name,
          amountStr: formatMoneyRounded(
            balances[n.id] ?? 0,
            n.currency ?? base,
          ),
          baseMinor: inBase(n),
          color: n.color,
          icon: iconIdOr(n.icon, WALLET_ICON),
          depth,
        }
      : groupOption(n, depth, baseTotal(n.id))
  const groupOption = (
    n: LocalBalanceNode,
    depth: number,
    total: number,
  ): FilterOption => ({
    value: `group:${n.id}`,
    kind: 'group',
    name: n.name,
    amountStr: formatMoneyRounded(total, base),
    baseMinor: total,
    color: n.color,
    icon: iconIdOr(n.icon, GROUP_ICON),
    depth,
  })
  const subtree = (n: LocalBalanceNode, depth: number): FilterOption[] => [
    option(n, depth),
    ...(children.get(n.id) ?? []).flatMap((c) => subtree(c, depth + 1)),
  ]

  const roots = children.get(null) ?? []
  const loose = roots.filter((n) => n.kind === 'wallet')
  const sections: ScopeSection<FilterOption>[] = [
    {
      label: null,
      options: [
        {
          value: 'all',
          kind: 'all',
          name: 'All accounts',
          amountStr: formatMoneyRounded(baseTotal(null), base),
          baseMinor: baseTotal(null),
          color: null,
          icon: null,
          depth: 0,
        },
      ],
    },
    ...roots
      .filter((n) => n.kind === 'group')
      .map((g) => ({ label: null, options: subtree(g, 0) })),
  ]
  if (loose.length > 0)
    sections.push({
      label: sections.length > 1 ? 'Not in a group' : 'Wallets',
      options: loose.map((w) => option(w, 0)),
    })
  return sections
}

/** The chosen accounts still on offer; `all` once none of them is (archived or gone). */
export function offeredScope(sections: ScopeSection[], scope: Scope): Scope {
  const offered = new Set(
    sections.flatMap((s) => s.options.map((o) => o.value)),
  )
  const picks = picksOf(scope)
  const kept = picks.filter((p) => offered.has(pickValue(p)))
  return kept.length === picks.length ? scope : scopeFromPicks(kept)
}

export const picksOf = (scope: Scope): AccountPick[] =>
  scope.type === 'all' ? [] : scope.type === 'accounts' ? scope.picks : [scope]

/** No pick is everything; a single pick is that account. */
export const scopeFromPicks = (picks: AccountPick[]): Scope =>
  picks.length === 0
    ? { type: 'all' }
    : picks.length === 1
      ? picks[0]
      : { type: 'accounts', picks }

/** A pick's option value in `scopeSections` ("wallet:<id>" / "group:<id>"). */
export const pickValue = (pick: AccountPick): string =>
  `${pick.type}:${pick.id}`

export function pickFromValue(value: string): AccountPick | null {
  if (value.startsWith('group:')) return { type: 'group', id: value.slice(6) }
  if (value.startsWith('wallet:')) return { type: 'wallet', id: value.slice(7) }
  return null
}

/** A stable string for a scope — the views memoise on it. */
export const scopeToValue = (scope: Scope): string =>
  scope.type === 'all' ? 'all' : picksOf(scope).map(pickValue).join(',')

export const scopeFromValue = (value: string): Scope =>
  scopeFromPicks(
    value
      .split(',')
      .map(pickFromValue)
      .filter((p): p is AccountPick => p !== null),
  )

// --- Shared filtering ----------------------------------------------------------------

const liveTxns = (data: SpendingData, scope: Scope): LocalTransaction[] => {
  const matcher = walletMatcher(scope, data.nodes)
  return data.txns.filter((t) => t.deleted === 0 && matcher(t.walletId))
}

const toBase = (t: LocalTransaction, data: SpendingData): number =>
  convertMinor(t.amount, t.currency, data.base, data.rates)

/**
 * A spend or income row — the only kind any total counts. Transfer legs and balance
 * adjustments move money, never earn or spend it.
 */
type FlowTxn = LocalTransaction & { type: TxType; categoryId: string }

const isFlow = (t: LocalTransaction): t is FlowTxn =>
  isCashflow(t.type) && t.categoryId !== null

type AdjustmentTxn = LocalTransaction & { type: AdjustmentType }

const isAdjustmentTxn = (t: LocalTransaction): t is AdjustmentTxn =>
  isAdjustment(t.type)

const flowTxns = (data: SpendingData, scope: Scope): FlowTxn[] =>
  liveTxns(data, scope).filter(isFlow)

/**
 * Σ wallet-held goal reservations dated in the window, in base currency — the hero's "Saved".
 * A reservation keeps the money in its wallet, so it is never a spend; a spend linked to a goal
 * is a payment that left the wallet and counts as Spent like any other.
 */
function savedInWindow(
  data: SpendingData,
  scope: Scope,
  win: DateWindow,
): number {
  const matcher = walletMatcher(scope, data.nodes)
  return (data.allocations ?? [])
    .filter(
      (a) =>
        a.deleted === 0 &&
        a.source === 'wallet' &&
        a.walletId !== null &&
        matcher(a.walletId) &&
        inWindow(a.date, win),
    )
    .reduce(
      (sum, a) =>
        sum + convertMinor(a.amount, a.currency, data.base, data.rates),
      0,
    )
}

const SAVED_SEGMENT = '__saved__'

// --- Cashflow hero -------------------------------------------------------------------

export type CashflowSegment = {
  key: string
  label: string
  color: string
  pct: number
  valueStr: string
  pctStr: string
}

export type CashflowView = {
  title: string
  sub: string
  incomeStr: string
  spentStr: string
  savedStr: string
  netStr: string
  hasSaved: boolean
  netPositive: boolean
  pillLabel: string
  txCount: number
  txCountStr: string
  segments: CashflowSegment[]
  topLabel: string
  topColor: string
}

export function buildCashflow(
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CashflowView {
  const win = windowOf(anchor, mode)
  const txns = flowTxns(data, scope).filter((t) => inWindow(t.date, win))

  let income = 0
  let spent = 0
  const byCat = new Map<string, number>()
  for (const t of txns) {
    const v = toBase(t, data)
    if (t.type === 'income') {
      income += v
      continue
    }
    spent += v
    const root = catalog.rootOf(t.categoryId).id
    byCat.set(root, (byCat.get(root) ?? 0) + v)
  }
  const saved = savedInWindow(data, scope, win)
  const net = income - spent - saved
  const outflow = spent + saved
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const denom = Math.max(outflow, 1)
  const savedSegment =
    saved > 0
      ? [
          {
            key: SAVED_SEGMENT,
            label: 'Set aside',
            color: 'var(--fp-text-3)',
            pct: (saved / denom) * 100,
            valueStr: formatMoneyRounded(saved, data.base),
            pctStr: `${formatShare((saved / denom) * 100)} of outflow`,
          },
        ]
      : []

  const periodLabel = rangeLabel(anchor, mode, win, dateFormat)

  return {
    title: 'Cashflow',
    sub: periodLabel,
    incomeStr: formatMoneyRounded(income, data.base),
    spentStr: formatMoneyRounded(spent, data.base),
    savedStr: formatMoneyRounded(saved, data.base),
    netStr: `${net >= 0 ? '+' : '−'}${formatMoneyRounded(Math.abs(net), data.base)}`,
    hasSaved: saved > 0,
    netPositive: net >= 0,
    pillLabel: net >= 0 ? 'Net positive' : 'Net negative',
    txCount: txns.length,
    txCountStr: `${txns.length} transaction${txns.length === 1 ? '' : 's'}`,
    segments: [
      ...sorted.map(([cat, v]) => {
        const pct = (v / denom) * 100
        return {
          key: cat,
          label: catalog.get(cat).name,
          color: catalog.get(cat).color,
          pct,
          valueStr: formatMoneyRounded(v, data.base),
          pctStr: `${formatShare(pct)} of outflow`,
        }
      }),
      ...savedSegment,
    ],
    topLabel: sorted.length
      ? `Top: ${catalog.get(sorted[0][0]).name} ${formatMoneyRounded(sorted[0][1], data.base)}`
      : 'No spend yet',
    topColor: sorted.length
      ? catalog.get(sorted[0][0]).color
      : 'var(--fp-border-strong)',
  }
}

// --- Breakdown donut -----------------------------------------------------------------

export type BreakdownItem = { name: string; color: string; pctStr: string }
export type BreakdownView = {
  sub: string
  hasData: boolean
  centerStr: string
  gradient: string
  items: BreakdownItem[]
}

export function buildBreakdown(
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): BreakdownView {
  const win = windowOf(anchor, mode)
  const txns = flowTxns(data, scope).filter(
    (t) => inWindow(t.date, win) && t.type === 'spend',
  )
  // Keyed on the root, so a row filed under a child lands in its parent's segment.
  const byCat = new Map<string, number>()
  let outflow = 0
  for (const t of txns) {
    const v = toBase(t, data)
    outflow += v
    const root = catalog.rootOf(t.categoryId).id
    byCat.set(root, (byCat.get(root) ?? 0) + v)
  }
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const denom = Math.max(outflow, 1)

  let acc = 0
  const stops: string[] = []
  for (const [cat, v] of sorted) {
    const a0 = (acc / denom) * 100
    acc += v
    const a1 = (acc / denom) * 100
    stops.push(`${catalog.get(cat).color} ${a0.toFixed(2)}% ${a1.toFixed(2)}%`)
  }
  if (stops.length === 0) stops.push('var(--fp-surface-2) 0% 100%')

  const periodLabel = rangeLabel(anchor, mode, win, dateFormat)

  return {
    sub: periodLabel,
    hasData: sorted.length > 0,
    centerStr: fmtK(outflow, data.base),
    gradient: `conic-gradient(${stops.join(',')})`,
    items: sorted.slice(0, 5).map(([cat, v]) => ({
      name: catalog.get(cat).name,
      color: catalog.get(cat).color,
      pctStr: `${Math.round((v / denom) * 100)}%`,
    })),
  }
}

// --- Transaction list (grouped by day) -----------------------------------------------

export type TxRow = {
  kind: 'tx'
  id: string
  /** The leaf the row is filed under — its icon is the most specific one to draw. */
  categoryId: string
  /** The note, else the leaf category's own name ("Cafés" rather than "Dining"). */
  name: string
  /** ["Dining"], or ["Dining", "Cafés"] once the row names a child. */
  catPath: string[]
  color: string
  /** ["Main"], or ["Personal", "Main"] when the scope spans more than one wallet. */
  walletPath: string[]
  walletColor: string
  isIncome: boolean
  /** The pill before the meta: what a confirmed planned item (or a goal spend) was. */
  tag: TxTag | null
  amountStr: string
}

export type TxTag = 'goal' | 'obligation' | 'income'

export const TX_TAG_LABEL: Record<TxTag, string> = {
  goal: 'Goal',
  obligation: 'Obligation',
  income: 'Income',
}

/**
 * A confirmed planned payday reads "Income", a confirmed planned payment "Obligation"; an
 * unplanned spend toward a goal keeps its "Goal" pill.
 */
export const txTagOf = (t: LocalTransaction): TxTag | null =>
  t.plannedId && t.type === 'income'
    ? 'income'
    : t.plannedId && t.type === 'spend'
      ? 'obligation'
      : t.type === 'spend' && t.goalId !== null
        ? 'goal'
        : null

/**
 * One transfer, however many of its legs are held. `neutral` when the scope holds both
 * sides; otherwise the side in scope decides whether money left (`out`) or arrived (`in`).
 */
export type TransferRow = {
  kind: 'transfer'
  id: string
  name: string
  fromName: string
  fromColor: string
  toName: string
  toColor: string
  direction: 'neutral' | 'out' | 'in'
  amountStr: string
}

/** A goal reservation — money held aside in a wallet (or outside one), not spent. */
export type SetAsideRow = {
  kind: 'set_aside'
  id: string
  goalId: string
  /** The goal's name. */
  name: string
  /** "Main Checking", or an external source's label. */
  sourceName: string
  sourceColor: string
  amountStr: string
}

/** A balance adjustment — a correction to one wallet's balance, never counted in a total. */
export type AdjustmentRow = {
  kind: 'adjustment'
  id: string
  /** The note, else "Balance adjustment". */
  name: string
  walletName: string
  walletColor: string
  direction: 'in' | 'out'
  amountStr: string
}

export const ADJUSTMENT_LABEL = 'Balance adjustment'

export type ActivityRow = TxRow | TransferRow | SetAsideRow | AdjustmentRow

export type DayGroup = {
  dateLabel: string
  totalStr: string
  rows: ActivityRow[]
}

export type ActivityListView = {
  groups: DayGroup[]
  empty: boolean
  emptyTitle: string
  emptyText: string
  countStr: string
}

export const DELETED_ACCOUNT = 'Deleted account'
// A day holding only transfers or adjustments has nothing to total.
const NO_DAY_TOTAL = '—'
const NO_WALLET_COLOR = 'var(--fp-border-strong)'

type ActivityContext = {
  data: SpendingData
  catalog: CategoryCatalog
  nodeById: Map<string, LocalBalanceNode>
  inScope: (walletId: string) => boolean
  /** Across several wallets a name alone is ambiguous, so the wallet's group prefixes it. */
  withGroup: boolean
}

function walletPathOf(
  wallet: LocalBalanceNode | undefined,
  ctx: ActivityContext,
  missing: string,
): string[] {
  if (!wallet) return [missing]
  const group =
    ctx.withGroup && wallet.parentId
      ? ctx.nodeById.get(wallet.parentId)
      : undefined
  return group ? [group.name, wallet.name] : [wallet.name]
}

function walletLabelOf(
  wallet: LocalBalanceNode | undefined,
  ctx: ActivityContext,
  missing: string,
): string {
  return walletPathOf(wallet, ctx, missing).join(' · ')
}

function txRowOf(t: FlowTxn, ctx: ActivityContext): TxRow {
  const cat = ctx.catalog.rootOf(t.categoryId)
  const wallet = ctx.nodeById.get(t.walletId)
  const isInc = t.type === 'income'
  return {
    kind: 'tx',
    id: t.id,
    categoryId: t.categoryId,
    name: t.note || ctx.catalog.get(t.categoryId).name,
    catPath: ctx.catalog.pathOf(t.categoryId),
    color: cat.color,
    walletPath: walletPathOf(wallet, ctx, ''),
    walletColor: wallet?.color ?? NO_WALLET_COLOR,
    isIncome: isInc,
    tag: txTagOf(t),
    amountStr: `${isInc ? '+' : '−'}${formatMoneyRounded(toBase(t, ctx.data), ctx.data.base)}`,
  }
}

function adjustmentRowOf(
  t: AdjustmentTxn,
  ctx: ActivityContext,
): AdjustmentRow {
  const wallet = ctx.nodeById.get(t.walletId)
  const direction = t.type === 'adjustment_in' ? 'in' : 'out'
  return {
    kind: 'adjustment',
    id: t.id,
    name: t.note || ADJUSTMENT_LABEL,
    walletName: walletLabelOf(wallet, ctx, DELETED_ACCOUNT),
    walletColor: wallet?.color ?? NO_WALLET_COLOR,
    direction,
    amountStr: `${direction === 'in' ? '+' : '−'}${formatMoneyRounded(toBase(t, ctx.data), ctx.data.base)}`,
  }
}

/** `null` when neither leg's wallet is in scope. A leg that is gone is never in scope. */
function transferRowOf(
  transferId: string,
  legs: ReadonlyArray<LocalTransaction>,
  ctx: ActivityContext,
): TransferRow | null {
  const out = legs.find((t) => t.type === 'transfer_out')
  const inn = legs.find((t) => t.type === 'transfer_in')
  const outIn = out !== undefined && ctx.inScope(out.walletId)
  const inIn = inn !== undefined && ctx.inScope(inn.walletId)
  if (!outIn && !inIn) return null

  const side = (leg: LocalTransaction | undefined) => {
    const wallet = leg ? ctx.nodeById.get(leg.walletId) : undefined
    return {
      name: wallet?.name ?? DELETED_ACCOUNT,
      label: walletLabelOf(wallet, ctx, DELETED_ACCOUNT),
      color: wallet?.color ?? NO_WALLET_COLOR,
    }
  }
  const from = side(out)
  const to = side(inn)
  const direction = outIn && inIn ? 'neutral' : outIn ? 'out' : 'in'
  const shown = direction === 'in' ? inn : out
  const money = shown
    ? formatMoneyRounded(toBase(shown, ctx.data), ctx.data.base)
    : ''
  const note = (out ?? inn)?.note

  return {
    kind: 'transfer',
    id: transferId,
    name:
      direction === 'neutral'
        ? note || 'Transfer'
        : direction === 'out'
          ? `Transfer to ${to.name}`
          : `Transfer from ${from.name}`,
    fromName: from.label,
    fromColor: from.color,
    toName: to.label,
    toColor: to.color,
    direction,
    amountStr:
      direction === 'neutral'
        ? money
        : `${direction === 'out' ? '−' : '+'}${money}`,
  }
}

function setAsideRowOf(
  a: LocalGoalAllocation,
  ctx: ActivityContext,
  goalNames: ReadonlyMap<string, string>,
): SetAsideRow {
  const wallet = a.walletId ? ctx.nodeById.get(a.walletId) : undefined
  return {
    kind: 'set_aside',
    id: a.id,
    goalId: a.goalId,
    name: goalNames.get(a.goalId) ?? 'Goal',
    sourceName:
      a.source === 'external'
        ? (a.externalLabel ?? 'External')
        : walletLabelOf(wallet, ctx, DELETED_ACCOUNT),
    sourceColor: wallet?.color ?? NO_WALLET_COLOR,
    amountStr: formatMoneyRounded(
      convertMinor(a.amount, a.currency, ctx.data.base, ctx.data.rates),
      ctx.data.base,
    ),
  }
}

/** Live reservations in the window: a wallet's when it is in scope, an external one only unscoped. */
function windowSetAsides(
  data: SpendingData,
  win: DateWindow,
  scope: Scope,
  inScope: (walletId: string) => boolean,
): LocalGoalAllocation[] {
  return (data.allocations ?? []).filter(
    (a) =>
      a.deleted === 0 &&
      inWindow(a.date, win) &&
      (a.source === 'wallet' && a.walletId
        ? inScope(a.walletId)
        : scope.type === 'all'),
  )
}

/**
 * Every live row in the window whose own wallet is in scope, plus — for a transfer — its
 * partner leg wherever it is, since the scope rules need both sides.
 */
function windowRows(
  data: SpendingData,
  win: DateWindow,
  inScope: (walletId: string) => boolean,
): LocalTransaction[] {
  const live = data.txns.filter((t) => t.deleted === 0 && inWindow(t.date, win))
  const touched = new Set(
    live
      .filter((t) => t.transferId && inScope(t.walletId))
      .map((t) => t.transferId),
  )
  return live.filter((t) =>
    t.transferId ? touched.has(t.transferId) : inScope(t.walletId),
  )
}

/** Rows of one day: ordinary rows as they are, a transfer's legs collapsed into one row. */
function dayRows(
  txns: ReadonlyArray<LocalTransaction>,
  ctx: ActivityContext,
): ActivityRow[] {
  const legsOf = new Map<string, LocalTransaction[]>()
  for (const t of txns) {
    if (!t.transferId) continue
    const legs = legsOf.get(t.transferId)
    if (legs) legs.push(t)
    else legsOf.set(t.transferId, [t])
  }
  const rows: ActivityRow[] = []
  const emitted = new Set<string>()
  for (const t of txns) {
    if (!t.transferId) {
      if (isFlow(t)) rows.push(txRowOf(t, ctx))
      else if (isAdjustmentTxn(t)) rows.push(adjustmentRowOf(t, ctx))
      continue
    }
    if (emitted.has(t.transferId)) continue
    emitted.add(t.transferId)
    const row = transferRowOf(t.transferId, legsOf.get(t.transferId)!, ctx)
    if (row) rows.push(row)
  }
  return rows
}

export function buildActivityList(
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): ActivityListView {
  const win = windowOf(anchor, mode)
  const ctx: ActivityContext = {
    data,
    catalog,
    nodeById: new Map(data.nodes.map((n) => [n.id, n])),
    inScope: walletMatcher(scope, data.nodes),
    withGroup: scope.type !== 'wallet',
  }
  const txns = windowRows(data, win, ctx.inScope).sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  )

  const byDay = new Map<string, LocalTransaction[]>()
  for (const t of txns) {
    const day = byDay.get(t.date)
    if (day) day.push(t)
    else byDay.set(t.date, [t])
  }
  const setAsidesByDay = new Map<string, LocalGoalAllocation[]>()
  for (const a of windowSetAsides(data, win, scope, ctx.inScope)) {
    const day = setAsidesByDay.get(a.date)
    if (day) day.push(a)
    else setAsidesByDay.set(a.date, [a])
  }
  const order = [...new Set([...byDay.keys(), ...setAsidesByDay.keys()])].sort(
    (a, b) => b.localeCompare(a),
  )
  const goalNames = new Map((data.goals ?? []).map((g) => [g.id, g.name]))

  const yesterday = addDays(today, -1)
  const groups: DayGroup[] = order.map((date) => {
    const txnsOfDay = byDay.get(date) ?? []
    const setAsideRows = (setAsidesByDay.get(date) ?? [])
      .sort((a, b) => b.id.localeCompare(a.id))
      .map((a) => setAsideRowOf(a, ctx, goalNames))
    let spent = 0
    let income = 0
    for (const t of txnsOfDay) {
      if (!isFlow(t)) continue
      const v = toBase(t, data)
      if (t.type === 'income') income += v
      else spent += v
    }
    const d = parseISO(date)
    const prefix = sameDay(d, today)
      ? 'Today · '
      : sameDay(d, yesterday)
        ? 'Yesterday · '
        : ''
    const totalStr =
      (spent > 0 ? `−${formatMoneyRounded(spent, data.base)}` : '') +
        (income > 0
          ? `${spent > 0 ? '  ' : ''}+${formatMoneyRounded(income, data.base)}`
          : '') || NO_DAY_TOTAL
    return {
      dateLabel: prefix + formatDate(d, dateFormat),
      totalStr,
      rows: [...dayRows(txnsOfDay, ctx), ...setAsideRows],
    }
  })

  const count = groups.reduce((n, g) => n + g.rows.length, 0)
  const countStr =
    mode === 'week'
      ? `${count} this week`
      : mode === 'day'
        ? `${count} on ${fmtShort(anchor)}`
        : `${count} in ${rangeLabel(anchor, mode, win, DEFAULT_DATE_FORMAT)}`

  const accounts = scope.type === 'accounts' ? 'these accounts' : 'this account'
  const emptyTitle =
    scope.type === 'all'
      ? 'No transactions in this period'
      : `Nothing for ${accounts}`
  const emptyText =
    scope.type === 'all'
      ? 'Add one with the quick-add panel.'
      : `Nothing was recorded on ${accounts} in this period.`

  return { groups, empty: count === 0, emptyTitle, emptyText, countStr }
}

// --- Calendar (day grid that unfolds to a month; month grid for the year) ------------

/** One clickable bucket in the calendar: a day in the day grid, a month in the year grid. */
export type PeriodCell = {
  key: string
  label: string
  /** Outside the selected period (day, week, month or year). */
  outside: boolean
  /** Today, or the running month in the year grid. */
  isCurrent: boolean
  /** The one period you picked — a day in day view. */
  isActive: boolean
  hasActivity: boolean
  hasBoth: boolean
  netStr: string
  /** Sign of the net: income over spend, spend over income, or even (incl. no activity). */
  tone: 'pos' | 'neg' | 'zero'
  incStr: string
  spendStr: string
  /** 0..1 — the net's size against the period's biggest net of the same sign. */
  intensity: number
}

type CellFlags = Pick<
  PeriodCell,
  'key' | 'label' | 'outside' | 'isCurrent' | 'isActive'
>

/** The biggest gain and the biggest loss in a scaling period, both as positive amounts. */
type NetPeaks = { pos: number; neg: number }

const cellOf = (
  flags: CellFlags,
  inc: number,
  spend: number,
  peaks: NetPeaks,
  base: CurrencyCode,
): PeriodCell => {
  const net = inc - spend
  const tone = net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'
  const peak = tone === 'zero' ? 0 : peaks[tone]
  return {
    ...flags,
    hasActivity: spend > 0 || inc > 0,
    hasBoth: spend > 0 && inc > 0,
    netStr: `${net >= 0 ? '+' : '−'}${fmtK(Math.abs(net), base)}`,
    tone,
    incStr: `+${fmtK(inc, base)}`,
    spendStr: `−${fmtK(spend, base)}`,
    // Square root so a small day still reads next to one huge one; capped because a
    // neighbouring month's day can outgrow the period's peak.
    intensity: peak > 0 ? Math.min(1, Math.sqrt(Math.abs(net) / peak)) : 0,
  }
}

function netPeaks(
  inc: Map<string, number>,
  spend: Map<string, number>,
  inScope: (key: string) => boolean,
): NetPeaks {
  const peaks = { pos: 0, neg: 0 }
  for (const k of new Set([...inc.keys(), ...spend.keys()])) {
    if (!inScope(k)) continue
    const net = (inc.get(k) ?? 0) - (spend.get(k) ?? 0)
    if (net > 0) peaks.pos = Math.max(peaks.pos, net)
    else peaks.neg = Math.max(peaks.neg, -net)
  }
  return peaks
}

/** The row that stays visible when a grid is folded shut, plus the rows that fold away. */
type FoldingRows = {
  pivotRow: PeriodCell[]
  rowsBefore: PeriodCell[][]
  rowsAfter: PeriodCell[][]
}

export type DayGridView = FoldingRows & {
  grid: 'days'
  weekdayLabels: string[]
  caption: string
}

export type MonthGridView = FoldingRows & {
  grid: 'months'
  caption: string
}

const MONTHS_PER_ROW = 4

/** Splits cells into rows, with the row holding `pivotIndex` held out as the pivot. */
function foldAround(
  cells: PeriodCell[],
  perRow: number,
  pivotIndex: number,
): FoldingRows {
  const rows: PeriodCell[][] = []
  for (let i = 0; i < cells.length; i += perRow)
    rows.push(cells.slice(i, i + perRow))
  const pivot = Math.floor(pivotIndex / perRow)
  return {
    pivotRow: rows[pivot] ?? [],
    rowsBefore: rows.slice(0, pivot),
    rowsAfter: rows.slice(pivot + 1),
  }
}

export type CalendarView = DayGridView | MonthGridView

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Income and spend per ISO day, in base currency. */
function perDayTotals(txns: FlowTxn[], data: SpendingData) {
  const spend = new Map<string, number>()
  const inc = new Map<string, number>()
  for (const t of txns) {
    const v = toBase(t, data)
    const bucket = t.type === 'income' ? inc : spend
    bucket.set(t.date, (bucket.get(t.date) ?? 0) + v)
  }
  return { spend, inc }
}

/** The anchor month's grid of whole weeks: the first week's start and the last week's. */
function monthWeeks(anchor: Date): { first: Date; last: Date } {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  return {
    first: startOfWeek(new Date(y, m, 1)),
    last: startOfWeek(new Date(y, m + 1, 0)),
  }
}

/**
 * Every day the calendar can show for this anchor: the year, or the whole weeks of the
 * anchor's month — which hold any week the day grid pins open, as it lies in that month.
 */
export function calendarSpan(anchor: Date, mode: RangeMode): DateWindow {
  if (mode === 'year') return windowOf(anchor, 'year')
  const { first, last } = monthWeeks(anchor)
  return { start: first, end: addDays(last, 6) }
}

function buildDayGrid(
  data: SpendingData,
  txns: FlowTxn[],
  anchor: Date,
  mode: RangeMode,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat,
): DayGridView {
  const { spend: perDaySpend, inc: perDayInc } = perDayTotals(txns, data)

  const calY = anchor.getFullYear()
  const calM = anchor.getMonth()
  const curMonth = sameMonth(anchor, today)
  const weekStart =
    mode === 'month'
      ? startOfWeek(curMonth ? today : new Date(calY, calM, 1))
      : startOfWeek(anchor)

  // Shades scale against the anchor's month in every mode, so a day keeps its shade as you
  // move between month, week and day view.
  const peaks = netPeaks(perDayInc, perDaySpend, (k) => {
    const d = parseISO(k)
    return d.getFullYear() === calY && d.getMonth() === calM
  })
  const selected = windowOf(anchor, mode)

  const cellFor = (d: Date): PeriodCell => {
    const k = dayKey(d)
    return cellOf(
      {
        key: k,
        label: String(d.getDate()),
        outside: !inWindow(k, selected),
        isCurrent: sameDay(d, today),
        isActive: mode === 'day' && dayKey(anchor) === k,
      },
      perDayInc.get(k) ?? 0,
      perDaySpend.get(k) ?? 0,
      peaks,
      data.base,
    )
  }

  const weekOf = (start: Date) =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => cellFor(addDays(start, i)))

  const { first: gridStart, last: lastWeekStart } = monthWeeks(anchor)
  const weekIndex = (start: Date) =>
    Math.round((midnight(start) - midnight(gridStart)) / (7 * 86_400_000))
  const weekCount = weekIndex(lastWeekStart) + 1
  const pivotIndex = weekIndex(weekStart)

  const rowsBefore: PeriodCell[][] = []
  const rowsAfter: PeriodCell[][] = []
  for (let w = 0; w < weekCount; w += 1) {
    if (w === pivotIndex) continue
    const days = weekOf(addDays(gridStart, w * 7))
    if (w < pivotIndex) rowsBefore.push(days)
    else rowsAfter.push(days)
  }

  const weekSpan = `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}`
  const folded = `Week of ${weekSpan} — unfold for ${fmtMonth(anchor)}.`
  let caption: string
  if (calOpen) {
    caption = `${fmtMonth(anchor)} — tap any day to focus.`
  } else if (mode === 'day') {
    caption = `Focused on ${formatDate(anchor, dateFormat)} — tap another day, or unfold the month.`
  } else if (mode === 'week') {
    caption = `Week of ${weekSpan} — tap a day to focus it.`
  } else {
    caption = folded
  }

  return {
    grid: 'days',
    weekdayLabels: WEEKDAYS,
    pivotRow: weekOf(weekStart),
    rowsBefore,
    rowsAfter,
    caption,
  }
}

function buildMonthGrid(
  data: SpendingData,
  txns: FlowTxn[],
  anchor: Date,
  calOpen: boolean,
  today: Date,
): MonthGridView {
  const year = anchor.getFullYear()
  const perMonthSpend = new Map<string, number>()
  const perMonthInc = new Map<string, number>()
  for (const t of txns) {
    const d = parseISO(t.date)
    if (d.getFullYear() !== year) continue
    const k = monthKey(d)
    const bucket = t.type === 'income' ? perMonthInc : perMonthSpend
    bucket.set(k, (bucket.get(k) ?? 0) + toBase(t, data))
  }
  const peaks = netPeaks(perMonthInc, perMonthSpend, () => true)

  const months = [...Array(12).keys()].map((m) => {
    const d = new Date(year, m, 1)
    const k = monthKey(d)
    return cellOf(
      {
        key: k,
        label: fmtMonthShort(d),
        outside: false,
        isCurrent: sameMonth(d, today),
        isActive: false,
      },
      perMonthInc.get(k) ?? 0,
      perMonthSpend.get(k) ?? 0,
      peaks,
      data.base,
    )
  })

  // Fold shut around the running month when we're looking at the current year.
  const focus = year === today.getFullYear() ? today.getMonth() : 0
  const rows = foldAround(months, MONTHS_PER_ROW, focus)
  const span = `${rows.pivotRow[0]?.label} – ${rows.pivotRow[rows.pivotRow.length - 1]?.label}`

  return {
    grid: 'months',
    ...rows,
    caption: calOpen
      ? `${year} — tap a month to open it.`
      : `${span} ${year} — unfold for the full year.`,
  }
}

export function buildCalendar(
  data: SpendingData,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CalendarView {
  const txns = flowTxns(data, scope)
  return mode === 'year'
    ? buildMonthGrid(data, txns, anchor, calOpen, today)
    : buildDayGrid(data, txns, anchor, mode, calOpen, today, dateFormat)
}

// --- Budgets -------------------------------------------------------------------------

export type BudgetRow = {
  id: string
  name: string
  color: string
  /** The capped category's id, drawn as its icon; null for a wallet or overall cap. */
  categoryId: string | null
  scopeSub: string
  periodLabel: string
  spentStr: string
  limitStr: string
  remainStr: string
  pct: number
  pctStr: string
  barColor: string
  over: boolean
}

export type BudgetsView = {
  rows: BudgetRow[]
  empty: boolean
  countStr: string
  health: {
    onTrack: number
    over: number
    spentStr: string
    totalStr: string
    pct: number
    barColor: string
    leftStr: string
  }
}

const burnColor = (pct: number): string =>
  pct >= 1 ? RED : pct >= AT_RISK_RATIO ? AMBER : 'var(--fp-accent)'

function budgetSpentMinor(
  budget: LocalBudget,
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  today: Date,
): number {
  const win = budgetWindow(budget.period, budget.customDays, today)
  const matcher = walletMatcher(scope, data.nodes)
  let sum = 0
  for (const t of data.txns) {
    if (t.deleted || t.type !== 'spend') continue // transfers aren't budget spend
    if (!matcher(t.walletId)) continue
    if (!inWindow(t.date, win)) continue
    // Caps are root-scoped: a row filed under a child counts against its parent's cap.
    if (
      budget.scopeType === 'category' &&
      (t.categoryId === null ||
        (t.categoryId !== budget.categoryId &&
          catalog.rootOf(t.categoryId).id !== budget.categoryId))
    )
      continue
    if (budget.scopeType === 'wallet' && t.walletId !== budget.walletId)
      continue
    sum += convertMinor(t.amount, t.currency, budget.currency, data.rates)
  }
  return sum
}

export function buildBudgetsView(
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  today: Date,
): BudgetsView {
  const budgets = data.budgets.filter((b) => b.deleted === 0)
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]))

  const rows: BudgetRow[] = budgets.map((b) => {
    const spent = budgetSpentMinor(b, data, catalog, scope, today)
    const pct = b.limit > 0 ? spent / b.limit : 0
    const over = pct >= 1
    const remain = b.limit - spent
    let name = 'Total spendable'
    let color = '#64748B'
    let categoryId: string | null = null
    let scopeSub = 'Everything combined'
    if (b.scopeType === 'category') {
      const cat = catalog.get(b.categoryId ?? DELETED_CATEGORY_ID)
      name = cat.name
      color = cat.color
      categoryId = cat.id
      scopeSub = 'Category cap'
    } else if (b.scopeType === 'wallet') {
      const w = nodeById.get(b.walletId ?? '')
      name = w?.name ?? 'Account'
      color = w?.color ?? '#64748B'
      scopeSub = 'Account cap'
    }
    const periodLabel =
      b.period === 'custom'
        ? `${b.customDays ?? 30}d`
        : b.period === 'weekly'
          ? 'Weekly'
          : 'Monthly'
    return {
      id: b.id,
      name,
      color,
      categoryId,
      scopeSub,
      periodLabel,
      spentStr: formatMoneyRounded(spent, b.currency),
      limitStr: formatMoneyRounded(b.limit, b.currency),
      remainStr: over
        ? `Over by ${formatMoneyRounded(-remain, b.currency)}`
        : `${formatMoneyRounded(remain, b.currency)} left`,
      pct: Math.min(100, pct * 100),
      pctStr: `${Math.round(pct * 100)}%`,
      barColor: burnColor(pct),
      over,
    }
  })

  // Health rail: overall cap if present, else the sum of the non-overall caps.
  const overall = budgets.find((b) => b.scopeType === 'overall')
  const others = budgets.filter((b) => b.scopeType !== 'overall')
  let onTrack = 0
  let over = 0
  for (const b of budgets) {
    const spent = budgetSpentMinor(b, data, catalog, scope, today)
    const pct = b.limit > 0 ? spent / b.limit : 0
    if (pct >= 1) over += 1
    else onTrack += 1
  }
  const capLimit = overall
    ? convertMinor(overall.limit, overall.currency, data.base, data.rates)
    : others.reduce(
        (s, b) => s + convertMinor(b.limit, b.currency, data.base, data.rates),
        0,
      )
  const capSpent = overall
    ? budgetSpentMinor(overall, data, catalog, scope, today)
    : others.reduce(
        (s, b) => s + budgetSpentMinor(b, data, catalog, scope, today),
        0,
      )
  const capPct = capLimit > 0 ? capSpent / capLimit : 0
  const left = capLimit - capSpent

  return {
    rows,
    empty: budgets.length === 0,
    countStr: `${budgets.length} budget${budgets.length === 1 ? '' : 's'}`,
    health: {
      onTrack,
      over,
      spentStr: formatMoneyRounded(capSpent, data.base),
      totalStr: formatMoneyRounded(capLimit, data.base),
      pct: Math.min(100, capPct * 100),
      barColor: burnColor(capPct),
      leftStr:
        left >= 0
          ? `${formatMoneyRounded(left, data.base)} still spendable this month`
          : `Over your cap by ${formatMoneyRounded(-left, data.base)}`,
    },
  }
}

// --- Recurring -----------------------------------------------------------------------

export type RecurringRow = {
  id: string
  name: string
  color: string
  /** The leaf the schedule files under — its icon is the most specific one to draw. */
  categoryId: string
  catName: string
  walletName: string
  walletColor: string
  cadenceLabel: string
  autopost: boolean
  isIncome: boolean
  amountStr: string
  nextStr: string
  /** Past its end date: it schedules nothing more. */
  ended: boolean
  /** "until Jun 1, 2027" while an end date is still ahead; null when it repeats forever. */
  untilStr: string | null
}

export type UpcomingItem = {
  dateStr: string
  relStr: string
  name: string
  color: string
  isIncome: boolean
  amtStr: string
}

export type RecurringView = {
  rows: RecurringRow[]
  empty: boolean
  countStr: string
  monthlyStr: string
  dueThisStr: string
  activeCount: number
  nextLabel: string
  nextColor: string
  segments: CashflowSegment[]
  upcoming: UpcomingItem[]
  upcomingEmpty: boolean
}

/** A schedule whose next occurrence would fall after its end date. */
const hasEnded = (r: LocalRecurring): boolean =>
  r.endsOn != null && r.nextDue > r.endsOn

const fmtLong = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function buildRecurringView(
  data: SpendingData,
  catalog: CategoryCatalog,
  scope: Scope,
  today: Date,
): RecurringView {
  const matcher = walletMatcher(scope, data.nodes)
  const items = data.recurrings.filter(
    (r) => r.deleted === 0 && matcher(r.walletId),
  )
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]))
  const sorted = [...items].sort(
    (a, b) =>
      Number(hasEnded(a)) - Number(hasEnded(b)) ||
      a.nextDue.localeCompare(b.nextDue),
  )
  const live = sorted.filter((r) => !hasEnded(r))

  const spend = live.filter((r) => r.type === 'spend')
  const monthly = spend.reduce(
    (s, r) =>
      s +
      convertMinor(r.amount, r.currency, data.base, data.rates) *
        monthlyFactor(r.frequency),
    0,
  )

  const mStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const inThisMonth = (iso: string) => {
    const d = parseISO(iso)
    return midnight(d) >= midnight(mStart) && midnight(d) <= midnight(mEnd)
  }
  let dueThis = 0
  for (const r of live) {
    if (r.type === 'spend' && inThisMonth(r.nextDue))
      dueThis += convertMinor(r.amount, r.currency, data.base, data.rates)
  }

  const next =
    live.length > 0
      ? (live.find((r) => midnight(parseISO(r.nextDue)) >= midnight(today)) ??
        live[0])
      : undefined
  const denom = Math.max(monthly, 1)

  const rows: RecurringRow[] = sorted.map((r) => {
    const cat = catalog.rootOf(r.categoryId)
    const wallet = nodeById.get(r.walletId)
    return {
      id: r.id,
      name: r.name,
      color: cat.color,
      categoryId: r.categoryId,
      catName: cat.name,
      walletName: wallet?.name ?? '',
      walletColor: wallet?.color ?? 'var(--fp-border-strong)',
      cadenceLabel: FREQUENCIES[r.frequency].label,
      autopost: r.autopost,
      isIncome: r.type === 'income',
      amountStr: `${r.type === 'income' ? '+' : '−'}${formatMoneyRounded(
        convertMinor(r.amount, r.currency, data.base, data.rates),
        data.base,
      )}`,
      nextStr: fmtShort(parseISO(r.nextDue)),
      ended: hasEnded(r),
      untilStr:
        r.endsOn && !hasEnded(r)
          ? `until ${fmtLong(parseISO(r.endsOn))}`
          : null,
    }
  })

  const upcoming = live
    .filter((r) => inThisMonth(r.nextDue))
    .map((r): UpcomingItem => {
      const cat = catalog.rootOf(r.categoryId)
      return {
        dateStr: fmtShort(parseISO(r.nextDue)),
        relStr: relFuture(r.nextDue, today),
        name: r.name,
        color: cat.color,
        isIncome: r.type === 'income',
        amtStr: `${r.type === 'income' ? '+' : '−'}${formatMoneyRounded(
          convertMinor(r.amount, r.currency, data.base, data.rates),
          data.base,
        )}`,
      }
    })

  return {
    rows,
    empty: items.length === 0,
    countStr: `${items.length} item${items.length === 1 ? '' : 's'}`,
    monthlyStr: formatMoneyRounded(monthly, data.base),
    dueThisStr: formatMoneyRounded(dueThis, data.base),
    activeCount: live.length,
    nextLabel: next
      ? `Next: ${next.name} · ${fmtShort(parseISO(next.nextDue))}`
      : 'Nothing scheduled',
    nextColor: next
      ? catalog.rootOf(next.categoryId).color
      : 'var(--fp-border-strong)',
    segments: spend.map((r) => {
      const perMonth =
        convertMinor(r.amount, r.currency, data.base, data.rates) *
        monthlyFactor(r.frequency)
      const pct = (perMonth / denom) * 100
      return {
        key: r.id,
        label: r.name,
        color: catalog.rootOf(r.categoryId).color,
        pct,
        valueStr: `${formatMoneyRounded(perMonth, data.base)}/mo`,
        pctStr: `${formatShare(pct)} of monthly`,
      }
    }),
    upcoming,
    upcomingEmpty: upcoming.length === 0,
  }
}
