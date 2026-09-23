import { convertMinor, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatShare } from '#/lib/percent'
import { DEFAULT_DATE_FORMAT, formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { FREQUENCIES } from '#/features/goals/constants'
import type { TxType } from '#/features/transactions/api/types'
import { isTransferLeg } from '#/features/transactions/api/types'
import { AMBER, AT_RISK_RATIO, RED } from '#/features/transactions/constants'
import type { RangeMode } from '#/features/transactions/constants'
import type { DateWindow } from './planning'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { walletLiveBalances } from './ledger'
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

type RatesMap = Partial<Record<string, number>>

export type Scope =
  | { type: 'all' }
  | { type: 'wallet'; id: string }
  | { type: 'group'; id: string }

export type SpendingData = {
  txns: LocalTransaction[]
  budgets: LocalBudget[]
  recurrings: LocalRecurring[]
  nodes: LocalBalanceNode[]
  base: CurrencyCode
  rates: RatesMap
}

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
  if (scope.type === 'wallet') return (id) => id === scope.id
  const groups = ancestorGroups(nodes)
  return (id) => groups.get(id)?.has(scope.id) ?? false
}

export function scopeOptions(data: SpendingData) {
  const { nodes, txns, base, rates } = data
  const balances = walletLiveBalances(nodes, txns, rates)
  const wallets = nodes.filter((n) => n.kind === 'wallet')
  const groups = nodes.filter((n) => n.kind === 'group')

  const inBase = (walletId: string): number => {
    const node = nodes.find((n) => n.id === walletId)
    const cur = node?.currency ?? base
    return convertMinor(balances[walletId] ?? 0, cur, base, rates)
  }
  const groupTotal = (groupId: string): number => {
    const matcher = walletMatcher({ type: 'group', id: groupId }, nodes)
    return wallets
      .filter((w) => matcher(w.id))
      .reduce((sum, w) => sum + inBase(w.id), 0)
  }
  const allTotal = wallets.reduce((sum, w) => sum + inBase(w.id), 0)

  const options = [
    {
      value: 'all',
      label: `All accounts · ${formatMoneyRounded(allTotal, base)}`,
    },
    ...groups.map((g) => ({
      value: `group:${g.id}`,
      label: `${g.name} · ${formatMoneyRounded(groupTotal(g.id), base)}`,
    })),
    ...wallets.map((w) => ({
      value: `wallet:${w.id}`,
      label: `${w.name} · ${formatMoneyRounded(
        balances[w.id] ?? 0,
        w.currency ?? base,
      )}`,
    })),
  ]
  return options
}

export function scopeFromValue(value: string): Scope {
  if (value.startsWith('group:')) return { type: 'group', id: value.slice(6) }
  if (value.startsWith('wallet:')) return { type: 'wallet', id: value.slice(7) }
  return { type: 'all' }
}

export function scopeToValue(scope: Scope): string {
  if (scope.type === 'group') return `group:${scope.id}`
  if (scope.type === 'wallet') return `wallet:${scope.id}`
  return 'all'
}

// --- Shared filtering ----------------------------------------------------------------

const liveTxns = (data: SpendingData, scope: Scope): LocalTransaction[] => {
  const matcher = walletMatcher(scope, data.nodes)
  return data.txns.filter((t) => t.deleted === 0 && matcher(t.walletId))
}

const toBase = (t: LocalTransaction, data: SpendingData): number =>
  convertMinor(t.amount, t.currency, data.base, data.rates)

/** A spend or income row — the only kind any total counts. Transfer legs move money, never earn or spend it. */
type FlowTxn = LocalTransaction & { type: TxType; category: string }

const isFlow = (t: LocalTransaction): t is FlowTxn =>
  !isTransferLeg(t.type) && t.category !== null

const flowTxns = (data: SpendingData, scope: Scope): FlowTxn[] =>
  liveTxns(data, scope).filter(isFlow)

const isContribution = (t: LocalTransaction): boolean =>
  t.type === 'spend' && t.goalId !== null

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
  let saved = 0
  const byCat = new Map<string, number>()
  for (const t of txns) {
    const v = toBase(t, data)
    if (t.type === 'income') {
      income += v
      continue
    }
    if (isContribution(t)) saved += v
    else spent += v
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + v)
  }
  const net = income - spent - saved
  const outflow = spent + saved
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const denom = Math.max(outflow, 1)

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
    pillLabel: net >= 0 ? 'Net positive' : 'Overspending',
    txCount: txns.length,
    txCountStr: `${txns.length} transaction${txns.length === 1 ? '' : 's'}`,
    segments: sorted.map(([cat, v]) => {
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
  // Keyed on the parent slug alone, so a row filed under a child lands in its parent's segment.
  const byCat = new Map<string, number>()
  let outflow = 0
  for (const t of txns) {
    const v = toBase(t, data)
    outflow += v
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + v)
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
  categoryId: string
  subcategoryId: string | null
  name: string
  /** "Dining", or "Dining · Cafés" once the row names a child. */
  catLabel: string
  color: string
  walletName: string
  walletColor: string
  isIncome: boolean
  isContribution: boolean
  amountStr: string
}

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

export type ActivityRow = TxRow | TransferRow

export type DayGroup = {
  dateLabel: string
  totalStr: string
  rows: ActivityRow[]
}

export type ActivityListView = {
  groups: DayGroup[]
  empty: boolean
  emptyText: string
  countStr: string
}

const DELETED_ACCOUNT = 'Deleted account'
// A day holding only transfers has nothing to total.
const NO_DAY_TOTAL = '—'
const NO_WALLET_COLOR = 'var(--fp-border-strong)'

type ActivityContext = {
  data: SpendingData
  catalog: CategoryCatalog
  nodeById: Map<string, LocalBalanceNode>
  inScope: (walletId: string) => boolean
}

function txRowOf(t: FlowTxn, ctx: ActivityContext): TxRow {
  const cat = ctx.catalog.get(t.category)
  const wallet = ctx.nodeById.get(t.walletId)
  const isInc = t.type === 'income'
  return {
    kind: 'tx',
    id: t.id,
    categoryId: t.category,
    subcategoryId: t.subcategory,
    name: t.note || cat.name,
    catLabel: ctx.catalog.labelOf(t.category, t.subcategory),
    color: cat.color,
    walletName: wallet?.name ?? '',
    walletColor: wallet?.color ?? NO_WALLET_COLOR,
    isIncome: isInc,
    isContribution: isContribution(t),
    amountStr: `${isInc ? '+' : '−'}${formatMoneyRounded(toBase(t, ctx.data), ctx.data.base)}`,
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
    fromName: from.name,
    fromColor: from.color,
    toName: to.name,
    toColor: to.color,
    direction,
    amountStr:
      direction === 'neutral'
        ? money
        : `${direction === 'out' ? '−' : '+'}${money}`,
  }
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
  }
  const txns = windowRows(data, win, ctx.inScope).sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  )

  const byDay = new Map<string, LocalTransaction[]>()
  const order: string[] = []
  for (const t of txns) {
    if (!byDay.has(t.date)) {
      byDay.set(t.date, [])
      order.push(t.date)
    }
    byDay.get(t.date)!.push(t)
  }

  const yesterday = addDays(today, -1)
  const groups: DayGroup[] = order.map((date) => {
    const txnsOfDay = byDay.get(date)!
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
      rows: dayRows(txnsOfDay, ctx),
    }
  })

  const count = groups.reduce((n, g) => n + g.rows.length, 0)
  const countStr =
    mode === 'week'
      ? `${count} this week`
      : mode === 'day'
        ? `${count} on ${fmtShort(anchor)}`
        : `${count} in ${rangeLabel(anchor, mode, win, DEFAULT_DATE_FORMAT)}`

  const emptyText =
    scope.type === 'all'
      ? 'No transactions in this period — add one with the quick-add panel.'
      : 'Nothing for this account.'

  return { groups, empty: count === 0, emptyText, countStr }
}

// --- Calendar (day grid that unfolds to a month; month grid for the year) ------------

/** One clickable bucket in the calendar: a day in the day grid, a month in the year grid. */
export type PeriodCell = {
  key: string
  label: string
  /** Outside the focused month — rendered dimmed. Never true in the year grid. */
  outside: boolean
  /** Today, or the running month in the year grid. */
  isCurrent: boolean
  /** The one period you picked — a day in day view. Elsewhere only `isCurrent` marks a cell. */
  isActive: boolean
  hasActivity: boolean
  hasSpend: boolean
  hasBoth: boolean
  netStr: string
  netPositive: boolean
  incStr: string
  spendStr: string
  intensity: number // 0..1 spend heat
}

type CellFlags = Pick<
  PeriodCell,
  'key' | 'label' | 'outside' | 'isCurrent' | 'isActive'
>

const cellOf = (
  flags: CellFlags,
  inc: number,
  spend: number,
  maxSpend: number,
  base: CurrencyCode,
): PeriodCell => {
  const net = inc - spend
  return {
    ...flags,
    hasActivity: spend > 0 || inc > 0,
    hasSpend: spend > 0,
    hasBoth: spend > 0 && inc > 0,
    netStr: `${net >= 0 ? '+' : '−'}${fmtK(Math.abs(net), base)}`,
    netPositive: net >= 0,
    incStr: `+${fmtK(inc, base)}`,
    spendStr: `−${fmtK(spend, base)}`,
    intensity: maxSpend > 0 ? spend / maxSpend : 0,
  }
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

  let cMax = 0
  for (const [k, v] of perDaySpend) {
    const d = parseISO(k)
    if (d.getFullYear() === calY && d.getMonth() === calM && v > cMax) cMax = v
  }

  const cellFor = (d: Date): PeriodCell => {
    const k = dayKey(d)
    return cellOf(
      {
        key: k,
        label: String(d.getDate()),
        outside: d.getMonth() !== calM,
        isCurrent: sameDay(d, today),
        isActive: mode === 'day' && dayKey(anchor) === k,
      },
      perDayInc.get(k) ?? 0,
      perDaySpend.get(k) ?? 0,
      cMax,
      data.base,
    )
  }

  const weekOf = (start: Date) =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => cellFor(addDays(start, i)))

  const gridStart = startOfWeek(new Date(calY, calM, 1))
  const lastWeekStart = startOfWeek(new Date(calY, calM + 1, 0))
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
  const cMax = Math.max(0, ...perMonthSpend.values())

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
      cMax,
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
  categoryIcon: string | null
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
  scope: Scope,
  today: Date,
): number {
  const win = budgetWindow(budget.period, budget.customDays, today)
  const matcher = walletMatcher(scope, data.nodes)
  let sum = 0
  for (const t of data.txns) {
    if (t.deleted || t.type !== 'spend' || t.goalId) continue // savings and transfers aren't budget spend
    if (!matcher(t.walletId)) continue
    if (!inWindow(t.date, win)) continue
    // Caps are parent-scoped: the child a row may also name never narrows the match.
    if (budget.scopeType === 'category' && t.category !== budget.target)
      continue
    if (budget.scopeType === 'wallet' && t.walletId !== budget.target) continue
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
    const spent = budgetSpentMinor(b, data, scope, today)
    const pct = b.limit > 0 ? spent / b.limit : 0
    const over = pct >= 1
    const remain = b.limit - spent
    let name = 'Total spendable'
    let color = '#64748B'
    let categoryIcon: string | null = null
    let scopeSub = 'Everything combined'
    if (b.scopeType === 'category') {
      const cat = catalog.get(b.target ?? 'other')
      name = cat.name
      color = cat.color
      categoryIcon = cat.slug
      scopeSub = 'Category cap'
    } else if (b.scopeType === 'wallet') {
      const w = nodeById.get(b.target ?? '')
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
      categoryIcon,
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
    const spent = budgetSpentMinor(b, data, scope, today)
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
    ? budgetSpentMinor(overall, data, scope, today)
    : others.reduce((s, b) => s + budgetSpentMinor(b, data, scope, today), 0)
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
  categoryIcon: string
  catName: string
  walletName: string
  walletColor: string
  cadenceLabel: string
  autopost: boolean
  isIncome: boolean
  amountStr: string
  nextStr: string
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
  const sorted = [...items].sort((a, b) => a.nextDue.localeCompare(b.nextDue))

  const spend = items.filter((r) => r.type === 'spend')
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
  for (const r of items) {
    if (r.type === 'spend' && inThisMonth(r.nextDue))
      dueThis += convertMinor(r.amount, r.currency, data.base, data.rates)
  }

  const next =
    sorted.length > 0
      ? (sorted.find((r) => midnight(parseISO(r.nextDue)) >= midnight(today)) ??
        sorted[0])
      : undefined
  const denom = Math.max(monthly, 1)

  const rows: RecurringRow[] = sorted.map((r) => {
    const cat = catalog.get(r.category)
    const wallet = nodeById.get(r.walletId)
    return {
      id: r.id,
      name: r.name,
      color: cat.color,
      categoryIcon: cat.slug,
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
    }
  })

  const upcoming = sorted
    .filter((r) => inThisMonth(r.nextDue))
    .map((r): UpcomingItem => {
      const cat = catalog.get(r.category)
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
    activeCount: items.length,
    nextLabel: next
      ? `Next: ${next.name} · ${fmtShort(parseISO(next.nextDue))}`
      : 'Nothing scheduled',
    nextColor: next
      ? catalog.get(next.category).color
      : 'var(--fp-border-strong)',
    segments: spend.map((r) => {
      const perMonth =
        convertMinor(r.amount, r.currency, data.base, data.rates) *
        monthlyFactor(r.frequency)
      const pct = (perMonth / denom) * 100
      return {
        key: r.id,
        label: r.name,
        color: catalog.get(r.category).color,
        pct,
        valueStr: `${formatMoneyRounded(perMonth, data.base)}/mo`,
        pctStr: `${formatShare(pct)} of monthly`,
      }
    }),
    upcoming,
    upcomingEmpty: upcoming.length === 0,
  }
}
