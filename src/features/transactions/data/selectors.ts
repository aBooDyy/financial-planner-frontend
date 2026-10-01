import { convertMinor, formatMoney, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatShare } from '#/lib/percent'
import { DEFAULT_DATE_FORMAT, formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import type {
  LocalBalanceNode,
  LocalBill,
  LocalBudget,
  LocalGoal,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import type { AdjustmentType, TxType } from '#/features/transactions/api/types'
import { isAdjustment, isCashflow } from '#/features/transactions/api/types'
import { AMBER, AT_RISK_RATIO, RED } from '#/features/transactions/constants'
import type { DateWindow, Period } from './planning'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { liveBalancesFrom } from './ledger'
import { activeNodes } from '#/features/wallets/data/archive'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import type { IconId } from '#/lib/icons/catalog.gen'
import {
  addDays,
  addMonths,
  budgetWindow,
  dayKey,
  daysIn,
  fmtK,
  fmtMonth,
  fmtMonthShort,
  fmtShort,
  inWindow,
  midnight,
  monthKey,
  parseISO,
  sameDay,
  sameMonth,
  startOfWeek,
} from './planning'

/** "Jun 3 – Jul 14, 2026", or with both years when the span crosses one. */
function customLabel(win: DateWindow, dateFormat: DateFormat): string {
  const { start, end } = win
  if (sameDay(start, end)) return formatDate(start, dateFormat)
  if (start.getFullYear() === end.getFullYear())
    return `${fmtShort(start)} – ${fmtShort(end)}, ${end.getFullYear()}`
  return `${fmtShort(start)}, ${start.getFullYear()} – ${fmtShort(end)}, ${end.getFullYear()}`
}

/**
 * The caption for the period on screen, as the header, the hero and the donut head it:
 * "2026", "June 2026", "Jun 1 – Jun 7", a single date, or a custom span.
 */
export function periodCaption(
  period: Period,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const { mode, start, end } = period
  if (mode === 'day') return formatDate(start, dateFormat)
  if (mode === 'week') return `${fmtShort(start)} – ${fmtShort(end)}`
  if (mode === 'year') return String(start.getFullYear())
  if (mode === 'month') return fmtMonth(start)
  return customLabel(period, dateFormat)
}

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
  nodes: LocalBalanceNode[]
  base: CurrencyCode
  rates: RatesMap
  /** Set-asides — listed in Activity as "Set aside" rows, never counted in a total. */
  setAsides?: ReadonlyArray<LocalSetAside>
  /** Name the goal a set-aside row belongs to. */
  goals?: ReadonlyArray<Pick<LocalGoal, 'id' | 'name'>>
  /** Name the bill a set-aside row belongs to. */
  bills?: ReadonlyArray<Pick<LocalBill, 'id' | 'name'>>
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

export function walletMatcher(
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
 * Σ wallet-held set-asides dated in the window, in base currency — the hero's "Saved". A
 * set-aside keeps the money in its wallet, so it is never a spend; a spend linked to a goal or
 * bill is a payment that left the wallet and counts as Spent like any other.
 */
function savedInWindow(
  data: SpendingData,
  scope: Scope,
  win: DateWindow,
): number {
  const matcher = walletMatcher(scope, data.nodes)
  return (data.setAsides ?? [])
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
  win: Period,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CashflowView {
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

  return {
    title: 'Cashflow',
    sub: periodCaption(win, dateFormat),
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
  win: Period,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): BreakdownView {
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

  return {
    sub: periodCaption(win, dateFormat),
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

export type TxTag = 'goal' | 'bill' | 'income'

export const TX_TAG_LABEL: Record<TxTag, string> = {
  goal: 'Goal',
  bill: 'Bill',
  income: 'Income',
}

/**
 * A confirmed planned payday reads "Income", a payment for a bill "Bill"; a spend from a goal
 * keeps its "Goal" pill.
 */
export const txTagOf = (t: LocalTransaction): TxTag | null =>
  t.plannedId && t.type === 'income'
    ? 'income'
    : t.type === 'spend' && t.billId
      ? 'bill'
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
  /** The bill or goal it is set aside for. */
  ownerId: string
  /** The bill's or goal's name. */
  name: string
  /** "Main Checking", or where money held outside is. */
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
    amountStr: `${isInc ? '+' : '−'}${formatMoney(toBase(t, ctx.data), ctx.data.base)}`,
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
    amountStr: `${direction === 'in' ? '+' : '−'}${formatMoney(toBase(t, ctx.data), ctx.data.base)}`,
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
  const money = shown ? formatMoney(toBase(shown, ctx.data), ctx.data.base) : ''
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
  a: LocalSetAside,
  ctx: ActivityContext,
  ownerNames: ReadonlyMap<string, string>,
): SetAsideRow {
  const wallet = a.walletId ? ctx.nodeById.get(a.walletId) : undefined
  const ownerId = a.goalId ?? a.billId ?? ''
  return {
    kind: 'set_aside',
    id: a.id,
    ownerId,
    name: ownerNames.get(ownerId) ?? (a.billId ? 'Bill' : 'Goal'),
    sourceName:
      a.source === 'outside'
        ? (a.externalLabel ?? 'Outside')
        : walletLabelOf(wallet, ctx, DELETED_ACCOUNT),
    sourceColor: wallet?.color ?? NO_WALLET_COLOR,
    amountStr: formatMoney(
      convertMinor(a.amount, a.currency, ctx.data.base, ctx.data.rates),
      ctx.data.base,
    ),
  }
}

/** Set-asides made in the window: a wallet's when it is in scope, one held outside only unscoped. */
function windowSetAsides(
  data: SpendingData,
  win: DateWindow,
  scope: Scope,
  inScope: (walletId: string) => boolean,
): LocalSetAside[] {
  return (data.setAsides ?? []).filter(
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
  win: Period,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): ActivityListView {
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
  const setAsidesByDay = new Map<string, LocalSetAside[]>()
  for (const a of windowSetAsides(data, win, scope, ctx.inScope)) {
    const day = setAsidesByDay.get(a.date)
    if (day) day.push(a)
    else setAsidesByDay.set(a.date, [a])
  }
  const order = [...new Set([...byDay.keys(), ...setAsidesByDay.keys()])].sort(
    (a, b) => b.localeCompare(a),
  )
  const ownerNames = new Map(
    [...(data.goals ?? []), ...(data.bills ?? [])].map((o) => [o.id, o.name]),
  )

  const yesterday = addDays(today, -1)
  const groups: DayGroup[] = order.map((date) => {
    const txnsOfDay = byDay.get(date) ?? []
    const setAsideRows = (setAsidesByDay.get(date) ?? [])
      .sort((a, b) => b.id.localeCompare(a.id))
      .map((a) => setAsideRowOf(a, ctx, ownerNames))
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
      (spent > 0 ? `−${formatMoney(spent, data.base)}` : '') +
        (income > 0
          ? `${spent > 0 ? '  ' : ''}+${formatMoney(income, data.base)}`
          : '') || NO_DAY_TOTAL
    return {
      dateLabel: prefix + formatDate(d, dateFormat),
      totalStr,
      rows: [...dayRows(txnsOfDay, ctx), ...setAsideRows],
    }
  })

  const count = groups.reduce((n, g) => n + g.rows.length, 0)
  const countStr =
    win.mode === 'week'
      ? `${count} this week`
      : win.mode === 'day'
        ? `${count} on ${fmtShort(win.start)}`
        : `${count} in ${periodCaption(win, dateFormat)}`

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

/** The longest custom span still drawn as days; a longer one is drawn as months. */
export const CUSTOM_DAY_GRID_MAX_DAYS = 62

/** A year, or a custom span too long for days, is drawn as a grid of months. */
export const calendarGridOf = (period: Period): CalendarView['grid'] =>
  period.mode === 'year' ||
  (period.mode === 'custom' && daysIn(period) > CUSTOM_DAY_GRID_MAX_DAYS)
    ? 'months'
    : 'days'

/**
 * Every day the calendar can show for a period: the whole of a month grid; for a range mode,
 * the whole weeks of the anchor's month — which hold any week the day grid pins open, as it
 * lies in that month; for a custom span, the whole weeks it touches.
 */
export function calendarSpan(period: Period): DateWindow {
  if (calendarGridOf(period) === 'months') return period
  if (period.mode === 'custom')
    return {
      start: startOfWeek(period.start),
      end: addDays(startOfWeek(period.end), 6),
    }
  const { first, last } = monthWeeks(period.start)
  return { start: first, end: addDays(last, 6) }
}

/**
 * What a day grid lays out: its first and last week, the week held open when folded, the
 * days its shades scale against, and what unfolding it shows.
 */
type DayFrame = {
  first: Date
  last: Date
  pivot: Date
  scalesWith: (d: Date) => boolean
  whole: string
}

// A range mode scales against the anchor's month, so a day keeps its shade as you move
// between month, week and day view; a custom span scales against itself.
function dayFrame(
  period: Period,
  today: Date,
  dateFormat: DateFormat,
): DayFrame {
  if (period.mode === 'custom') {
    const first = startOfWeek(period.start)
    return {
      first,
      last: startOfWeek(period.end),
      pivot: inWindow(dayKey(today), period) ? startOfWeek(today) : first,
      scalesWith: (d) => inWindow(dayKey(d), period),
      whole: periodCaption(period, dateFormat),
    }
  }
  const anchor = period.start
  const { first, last } = monthWeeks(anchor)
  const pivot =
    period.mode === 'month'
      ? startOfWeek(sameMonth(anchor, today) ? today : anchor)
      : startOfWeek(anchor)
  return {
    first,
    last,
    pivot,
    scalesWith: (d) => sameMonth(d, anchor),
    whole: fmtMonth(anchor),
  }
}

function buildDayGrid(
  data: SpendingData,
  txns: FlowTxn[],
  period: Period,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat,
): DayGridView {
  const { spend: perDaySpend, inc: perDayInc } = perDayTotals(txns, data)
  const frame = dayFrame(period, today, dateFormat)
  const peaks = netPeaks(perDayInc, perDaySpend, (k) =>
    frame.scalesWith(parseISO(k)),
  )

  const cellFor = (d: Date): PeriodCell => {
    const k = dayKey(d)
    return cellOf(
      {
        key: k,
        label: String(d.getDate()),
        outside: !inWindow(k, period),
        isCurrent: sameDay(d, today),
        isActive: period.mode === 'day' && sameDay(period.start, d),
      },
      perDayInc.get(k) ?? 0,
      perDaySpend.get(k) ?? 0,
      peaks,
      data.base,
    )
  }

  const weekOf = (start: Date) =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => cellFor(addDays(start, i)))

  const weekIndex = (start: Date) =>
    Math.round((midnight(start) - midnight(frame.first)) / (7 * 86_400_000))
  const weekCount = weekIndex(frame.last) + 1
  const pivotIndex = weekIndex(frame.pivot)

  const rowsBefore: PeriodCell[][] = []
  const rowsAfter: PeriodCell[][] = []
  for (let w = 0; w < weekCount; w += 1) {
    if (w === pivotIndex) continue
    const days = weekOf(addDays(frame.first, w * 7))
    if (w < pivotIndex) rowsBefore.push(days)
    else rowsAfter.push(days)
  }

  const weekSpan = `${fmtShort(frame.pivot)} – ${fmtShort(addDays(frame.pivot, 6))}`
  let caption: string
  if (calOpen) {
    caption = `${frame.whole} — tap any day to focus.`
  } else if (period.mode === 'day') {
    caption = `Focused on ${formatDate(period.start, dateFormat)} — tap another day, or unfold the month.`
  } else if (period.mode === 'week') {
    caption = `Week of ${weekSpan} — tap a day to focus it.`
  } else {
    caption = `Week of ${weekSpan} — unfold for ${frame.whole}.`
  }

  return {
    grid: 'days',
    weekdayLabels: WEEKDAYS,
    pivotRow: weekOf(frame.pivot),
    rowsBefore,
    rowsAfter,
    caption,
  }
}

/** The first of every month the period touches, in order. */
function monthsOf(period: Period): Date[] {
  const months: Date[] = []
  for (
    let d = new Date(period.start.getFullYear(), period.start.getMonth(), 1);
    d <= period.end;
    d = addMonths(d, 1)
  )
    months.push(d)
  return months
}

function buildMonthGrid(
  data: SpendingData,
  txns: FlowTxn[],
  period: Period,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat,
): MonthGridView {
  const perMonthSpend = new Map<string, number>()
  const perMonthInc = new Map<string, number>()
  for (const t of txns) {
    if (!inWindow(t.date, period)) continue
    const k = monthKey(parseISO(t.date))
    const bucket = t.type === 'income' ? perMonthInc : perMonthSpend
    bucket.set(k, (bucket.get(k) ?? 0) + toBase(t, data))
  }
  const peaks = netPeaks(perMonthInc, perMonthSpend, () => true)

  const firsts = monthsOf(period)
  const oneYear = period.start.getFullYear() === period.end.getFullYear()
  const labelOf = (d: Date) =>
    oneYear
      ? fmtMonthShort(d)
      : `${fmtMonthShort(d)} ’${String(d.getFullYear()).slice(-2)}`
  const months = firsts.map((d) => {
    const k = monthKey(d)
    return cellOf(
      {
        key: k,
        label: labelOf(d),
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

  // Folds shut around the running month when the period holds it, else its first month.
  const focus = Math.max(
    0,
    firsts.findIndex((d) => sameMonth(d, today)),
  )
  const rows = foldAround(months, MONTHS_PER_ROW, focus)
  const span = `${rows.pivotRow[0]?.label} – ${rows.pivotRow[rows.pivotRow.length - 1]?.label}`

  if (period.mode === 'year') {
    const year = period.start.getFullYear()
    return {
      grid: 'months',
      ...rows,
      caption: calOpen
        ? `${year} — tap a month to open it.`
        : `${span} ${year} — unfold for the full year.`,
    }
  }
  const whole = periodCaption(period, dateFormat)
  return {
    grid: 'months',
    ...rows,
    caption: calOpen
      ? `${whole} — tap a month to open it.`
      : `${span} — unfold for ${whole}.`,
  }
}

export function buildCalendar(
  data: SpendingData,
  scope: Scope,
  period: Period,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CalendarView {
  const txns = flowTxns(data, scope)
  return calendarGridOf(period) === 'months'
    ? buildMonthGrid(data, txns, period, calOpen, today, dateFormat)
    : buildDayGrid(data, txns, period, calOpen, today, dateFormat)
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

export type BudgetIdentity = Pick<
  BudgetRow,
  'name' | 'color' | 'categoryId' | 'scopeSub'
>

/** What a budget is called and drawn as: its category, its account, or everything. */
export function budgetIdentity(
  b: LocalBudget,
  catalog: CategoryCatalog,
  nodeById: ReadonlyMap<string, LocalBalanceNode>,
): BudgetIdentity {
  if (b.scopeType === 'category') {
    const cat = catalog.get(b.categoryId ?? DELETED_CATEGORY_ID)
    return {
      name: cat.name,
      color: cat.color,
      categoryId: cat.id,
      scopeSub: 'Category cap',
    }
  }
  if (b.scopeType === 'wallet') {
    const w = nodeById.get(b.walletId ?? '')
    return {
      name: w?.name ?? 'Account',
      color: w?.color ?? '#64748B',
      categoryId: null,
      scopeSub: 'Account cap',
    }
  }
  return {
    name: 'Total spendable',
    color: '#64748B',
    categoryId: null,
    scopeSub: 'Everything combined',
  }
}

/** "Weekly", "Monthly", or a custom span's "30d". */
export const budgetPeriodLabel = (
  b: Pick<LocalBudget, 'period' | 'customDays'>,
): string =>
  b.period === 'custom'
    ? `${b.customDays ?? 30}d`
    : b.period === 'weekly'
      ? 'Weekly'
      : 'Monthly'

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
    return {
      id: b.id,
      ...budgetIdentity(b, catalog, nodeById),
      periodLabel: budgetPeriodLabel(b),
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
