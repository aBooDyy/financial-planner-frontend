import { convertMinor, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { DEFAULT_DATE_FORMAT, formatDate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import { FREQUENCIES } from '#/features/goals/constants'
import { AMBER, AT_RISK_RATIO, RED } from '#/features/transactions/constants'
import type { RangeMode } from '#/features/transactions/constants'
import { categoryOf } from '#/features/transactions/categories'
import { walletLiveBalances } from './ledger'
import {
  addDays,
  budgetWindow,
  dayKey,
  fmtK,
  fmtMonth,
  fmtShort,
  inWindow,
  midnight,
  monthlyFactor,
  parseISO,
  relFuture,
  sameDay,
  startOfWeek,
  windowOf,
} from './planning'

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

const isContribution = (t: LocalTransaction): boolean =>
  t.type === 'spend' && t.goalId !== null

// --- Cashflow hero -------------------------------------------------------------------

export type CashflowSegment = { color: string; pct: number }

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
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CashflowView {
  const win = windowOf(anchor, mode)
  const txns = liveTxns(data, scope).filter((t) => inWindow(t.date, win))

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

  const periodLabel =
    mode === 'day'
      ? formatDate(anchor, dateFormat)
      : mode === 'week'
        ? `${fmtShort(win.start)} – ${fmtShort(win.end)}`
        : fmtMonth(anchor)

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
    segments: sorted.map(([cat, v]) => ({
      color: categoryOf(cat).color,
      pct: (v / denom) * 100,
    })),
    topLabel: sorted.length
      ? `Top: ${categoryOf(sorted[0][0]).name} ${formatMoneyRounded(sorted[0][1], data.base)}`
      : 'No spend yet',
    topColor: sorted.length
      ? categoryOf(sorted[0][0]).color
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
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): BreakdownView {
  const win = windowOf(anchor, mode)
  const txns = liveTxns(data, scope).filter(
    (t) => inWindow(t.date, win) && t.type === 'spend',
  )
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
    stops.push(`${categoryOf(cat).color} ${a0.toFixed(2)}% ${a1.toFixed(2)}%`)
  }
  if (stops.length === 0) stops.push('var(--fp-surface-2) 0% 100%')

  const periodLabel =
    mode === 'day'
      ? formatDate(anchor, dateFormat)
      : mode === 'week'
        ? `${fmtShort(win.start)} – ${fmtShort(win.end)}`
        : fmtMonth(anchor)

  return {
    sub: periodLabel,
    hasData: sorted.length > 0,
    centerStr: fmtK(outflow),
    gradient: `conic-gradient(${stops.join(',')})`,
    items: sorted.slice(0, 5).map(([cat, v]) => ({
      name: categoryOf(cat).name,
      color: categoryOf(cat).color,
      pctStr: `${Math.round((v / denom) * 100)}%`,
    })),
  }
}

// --- Transaction list (grouped by day) -----------------------------------------------

export type TxRow = {
  id: string
  categoryId: string
  name: string
  catName: string
  subName: string | null
  color: string
  walletName: string
  walletColor: string
  isIncome: boolean
  isContribution: boolean
  amountStr: string
}

export type DayGroup = { dateLabel: string; totalStr: string; rows: TxRow[] }

export type ActivityListView = {
  groups: DayGroup[]
  empty: boolean
  countStr: string
}

export function buildActivityList(
  data: SpendingData,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): ActivityListView {
  const win = windowOf(anchor, mode)
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]))
  const txns = liveTxns(data, scope)
    .filter((t) => inWindow(t.date, win))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

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
    const rows = byDay.get(date)!
    let spent = 0
    let income = 0
    for (const t of rows) {
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
        : '')
    return {
      dateLabel: prefix + formatDate(d, dateFormat),
      totalStr,
      rows: rows.map((t): TxRow => {
        const cat = categoryOf(t.category)
        const wallet = nodeById.get(t.walletId)
        const isInc = t.type === 'income'
        return {
          id: t.id,
          categoryId: t.category,
          name: t.note || cat.name,
          catName: cat.name,
          subName: t.subcategory
            ? (cat.subs.find((s) => s.id === t.subcategory)?.name ?? null)
            : null,
          color: cat.color,
          walletName: wallet?.name ?? '',
          walletColor: wallet?.color ?? 'var(--fp-border-strong)',
          isIncome: isInc,
          isContribution: isContribution(t),
          amountStr: `${isInc ? '+' : '−'}${formatMoneyRounded(toBase(t, data), data.base)}`,
        }
      }),
    }
  })

  const count = txns.length
  const countStr =
    mode === 'month'
      ? `${count} in ${fmtMonth(anchor)}`
      : mode === 'week'
        ? `${count} this week`
        : `${count} on ${fmtShort(anchor)}`

  return { groups, empty: count === 0, countStr }
}

// --- Days calendar (week strip that unfolds to a month grid) -------------------------

export type DayCell = {
  key: string
  dayLabel: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  inWeekWindow: boolean
  hasActivity: boolean
  hasBoth: boolean
  netStr: string
  netPositive: boolean
  incStr: string
  spendStr: string
  intensity: number // 0..1 spend heat
}

export type CalendarView = {
  weekdayLabels: string[]
  pivotWeek: DayCell[]
  weeksBefore: DayCell[][]
  weeksAfter: DayCell[][]
  caption: string
  isMonth: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function buildCalendar(
  data: SpendingData,
  scope: Scope,
  anchor: Date,
  mode: RangeMode,
  calOpen: boolean,
  today: Date,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
): CalendarView {
  const txns = liveTxns(data, scope)
  const perDaySpend = new Map<string, number>()
  const perDayInc = new Map<string, number>()
  for (const t of txns) {
    const v = toBase(t, data)
    if (t.type === 'income')
      perDayInc.set(t.date, (perDayInc.get(t.date) ?? 0) + v)
    else perDaySpend.set(t.date, (perDaySpend.get(t.date) ?? 0) + v)
  }

  const calY = anchor.getFullYear()
  const calM = anchor.getMonth()
  const curMonth = calY === today.getFullYear() && calM === today.getMonth()
  const weekStart =
    mode === 'month'
      ? startOfWeek(curMonth ? today : new Date(calY, calM, 1))
      : startOfWeek(anchor)

  let cMax = 0
  for (const [k, v] of perDaySpend) {
    const d = parseISO(k)
    if (d.getFullYear() === calY && d.getMonth() === calM && v > cMax) cMax = v
  }

  const win = windowOf(anchor, mode)
  const cellFor = (d: Date): DayCell => {
    const k = dayKey(d)
    const sp = perDaySpend.get(k) ?? 0
    const inc = perDayInc.get(k) ?? 0
    const net = inc - sp
    return {
      key: k,
      dayLabel: String(d.getDate()),
      inMonth: d.getMonth() === calM,
      isToday: sameDay(d, today),
      isSelected: mode === 'day' && dayKey(anchor) === k,
      inWeekWindow:
        mode === 'week' &&
        midnight(d) >= midnight(win.start) &&
        midnight(d) <= midnight(win.end),
      hasActivity: sp > 0 || inc > 0,
      hasBoth: sp > 0 && inc > 0,
      netStr: `${net >= 0 ? '+' : '−'}${fmtK(Math.abs(net))}`,
      netPositive: net >= 0,
      incStr: `+${fmtK(inc)}`,
      spendStr: `−${fmtK(sp)}`,
      intensity: cMax > 0 ? sp / cMax : 0,
    }
  }

  const pivotWeek = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    cellFor(addDays(weekStart, i)),
  )

  const weeksBefore: DayCell[][] = []
  const weeksAfter: DayCell[][] = []
  if (mode === 'month') {
    const gridStart = startOfWeek(new Date(calY, calM, 1))
    const lastWeekStart = startOfWeek(new Date(calY, calM + 1, 0))
    const weekCount =
      Math.round(
        (midnight(lastWeekStart) - midnight(gridStart)) / (7 * 86_400_000),
      ) + 1
    const pivotIndex = Math.round(
      (midnight(weekStart) - midnight(gridStart)) / (7 * 86_400_000),
    )
    for (let w = 0; w < weekCount; w += 1) {
      if (w === pivotIndex) continue
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) =>
        cellFor(addDays(gridStart, w * 7 + i)),
      )
      if (w < pivotIndex) weeksBefore.push(days)
      else weeksAfter.push(days)
    }
  }

  let caption: string
  if (mode === 'day') {
    caption = `Focused on ${formatDate(anchor, dateFormat)} — tap another day, or switch to Week / Month.`
  } else if (mode === 'week') {
    caption = `Week of ${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))} — tap a day to focus it.`
  } else {
    caption = calOpen
      ? `${fmtMonth(anchor)} — tap any day to focus.`
      : `Week of ${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))} — unfold for the full month.`
  }

  return {
    weekdayLabels: WEEKDAYS,
    pivotWeek,
    weeksBefore,
    weeksAfter,
    caption,
    isMonth: mode === 'month',
  }
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
    if (t.deleted || t.type !== 'spend' || t.goalId) continue // savings isn't budget spend
    if (!matcher(t.walletId)) continue
    if (!inWindow(t.date, win)) continue
    if (budget.scopeType === 'category' && t.category !== budget.target)
      continue
    if (budget.scopeType === 'wallet' && t.walletId !== budget.target) continue
    sum += convertMinor(t.amount, t.currency, budget.currency, data.rates)
  }
  return sum
}

export function buildBudgetsView(
  data: SpendingData,
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
      const cat = categoryOf(b.target ?? 'other')
      name = cat.name
      color = cat.color
      categoryIcon = cat.id
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
    const cat = categoryOf(r.category)
    const wallet = nodeById.get(r.walletId)
    return {
      id: r.id,
      name: r.name,
      color: cat.color,
      categoryIcon: cat.id,
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
      const cat = categoryOf(r.category)
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
      ? categoryOf(next.category).color
      : 'var(--fp-border-strong)',
    segments: spend.map((r) => ({
      color: categoryOf(r.category).color,
      pct:
        ((convertMinor(r.amount, r.currency, data.base, data.rates) *
          monthlyFactor(r.frequency)) /
          denom) *
        100,
    })),
    upcoming,
    upcomingEmpty: upcoming.length === 0,
  }
}
