/**
 * Pure view models over planned rows — the Planned tab's three groups, a goal's plan-vs-today
 * box and its contributions list. Components render these; they compute nothing.
 */
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import type { GoalProgress } from '#/features/goals/data/progress'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO, dateOf, daysBetween } from './dates'
import type { DesiredPlanned } from './generate'
import { rowDrift } from './drift'
import type { RowDrift } from './drift'
import {
  behindOf,
  hasSettlements,
  remainderOf,
  settledOf,
  settlementsFor,
} from './settle'
import type { Behind, SettlementIndex } from './settle'
import { fitPlanFrom } from './fit'
import { goalOwner } from './owners'
import type { PlanOwner } from './owners'
import type { PlanHeader, PlanSnapshot } from './snapshot'

/** "Sep 1". */
export const shortDate = (iso: string): string =>
  dateOf(iso).toLocaleString('en-US', { month: 'short', day: 'numeric' })

/** Relative within two weeks ("in 3 days", "23 days late", "Due today"), else "Oct 1". */
export function relativeDue(date: string, today: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1 day late'
  if (days < 0) return `${-days} days late`
  if (days <= 14) return `in ${days} days`
  return shortDate(date)
}

// --- The Planned tab (1c) ------------------------------------------------------------

export type PlannedTag = 'goal' | 'bill' | 'income'

export const TAG_LABEL: Record<PlannedTag, string> = {
  goal: 'Goal',
  bill: 'Bill',
  income: 'Income',
}

export type PlannedRowView = {
  id: string
  item: LocalPlanned
  name: string
  tag: PlannedTag
  tagLabel: string
  /** Money comes in (income) or goes out / is put aside. */
  direction: 'in' | 'out'
  currency: CurrencyCode
  /** What is still open on it — the full amount unless partly settled. */
  remainder: number
  settled: number
  isPartial: boolean
  /** Remainder, formatted — the figure the row shows. */
  amountStr: string
  /** "of 1,500" when partly settled, else empty. */
  ofStr: string
  /** "Set-aside 3 of 8 · due Sep 1 · 23 days late" / "Due today · Main Checking". */
  metaStr: string
  relStr: string
  isDue: boolean
  walletId: string | null
  walletName: string | null
  /** A known wallet and nothing settled yet: Confirm needs no dialog. */
  oneTap: boolean
  /** The goal's set-aside sequence, e.g. 3 of 8; null for anything else. */
  sequence: { index: number; count: number } | null
}

export type PlannedListView = {
  due: PlannedRowView[]
  dueCount: number
  /** Open, dated after today and within the next 14 days. */
  next: PlannedRowView[]
  /** Σ income / Σ outflow of `next`, in base currency (set-asides count as outflow). */
  nextIn: number
  nextOut: number
  nextCaption: string
  /** Open, further out than 14 days (up to the planner's horizon). */
  later: PlannedRowView[]
  laterLabel: string
  isEmpty: boolean
}

export const NEXT_DAYS = 14

export type PlannedListInput = {
  planned: ReadonlyArray<LocalPlanned>
  nodes: ReadonlyArray<LocalBalanceNode>
  index: SettlementIndex
  rates: RatesMap
  base: CurrencyCode
  today: string
}

const tagOf = (item: LocalPlanned): PlannedTag => {
  if (item.role === 'income') return 'income'
  return item.origin === 'bill' || item.billId ? 'bill' : 'goal'
}

/** Each goal's generated set-asides in order, so a row can say "3 of 8". */
function sequences(
  planned: ReadonlyArray<LocalPlanned>,
): Map<string, { index: number; count: number }> {
  const byGoal = new Map<string, LocalPlanned[]>()
  for (const p of planned) {
    if (p.origin !== 'goal' || p.role !== 'set_aside' || !p.goalId) continue
    const list = byGoal.get(p.goalId)
    if (list) list.push(p)
    else byGoal.set(p.goalId, [p])
  }
  const out = new Map<string, { index: number; count: number }>()
  for (const list of byGoal.values()) {
    list.sort((a, b) => a.occurrence.localeCompare(b.occurrence))
    list.forEach((p, i) => out.set(p.id, { index: i + 1, count: list.length }))
  }
  return out
}

export function buildPlannedList(input: PlannedListInput): PlannedListView {
  const { index, rates, base, today } = input
  const wallets = new Map(
    input.nodes.filter((n) => n.kind === 'wallet').map((n) => [n.id, n]),
  )
  const live = input.planned.filter((p) => p.deleted === 0)
  const seq = sequences(live)
  const nextUntil = addDaysISO(today, NEXT_DAYS)

  const view = (item: LocalPlanned): PlannedRowView => {
    const settled = settledOf(item, index, rates)
    const remainder = Math.max(0, item.amount - settled)
    const tag = tagOf(item)
    const isDue = item.date <= today
    const wallet = item.walletId ? wallets.get(item.walletId) : undefined
    const sequence = seq.get(item.id) ?? null
    const relStr = relativeDue(item.date, today)
    const lead = sequence
      ? `Set-aside ${sequence.index} of ${sequence.count}`
      : null
    const meta = isDue
      ? [
          lead,
          item.date === today ? 'Due today' : `due ${shortDate(item.date)}`,
          item.date === today ? null : relStr,
          lead ? null : (wallet?.name ?? null),
        ]
      : [lead, relStr, wallet?.name ?? null]
    return {
      id: item.id,
      item,
      name: item.name,
      tag,
      tagLabel: TAG_LABEL[tag],
      direction: item.role === 'income' ? 'in' : 'out',
      currency: item.currency,
      remainder,
      settled,
      isPartial: settled > 0,
      amountStr: formatMoney(remainder, item.currency),
      ofStr: settled > 0 ? `of ${formatMoney(item.amount, item.currency)}` : '',
      metaStr: meta.filter(Boolean).join(' · '),
      relStr,
      isDue,
      walletId: wallet ? item.walletId : null,
      walletName: wallet?.name ?? null,
      oneTap: !!wallet && settled === 0,
      sequence,
    }
  }

  const open = live
    .filter((p) => p.status === 'open')
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.occurrence.localeCompare(b.occurrence) ||
        a.name.localeCompare(b.name),
    )
  const due = open.filter((p) => p.date <= today).map(view)
  const next = open
    .filter((p) => p.date > today && p.date <= nextUntil)
    .map(view)
  const later = open.filter((p) => p.date > nextUntil).map(view)

  const inBase = (r: PlannedRowView) =>
    convertMinor(r.remainder, r.currency, base, rates)
  const nextIn = next
    .filter((r) => r.direction === 'in')
    .reduce((a, r) => a + inBase(r), 0)
  const nextOut = next
    .filter((r) => r.direction === 'out')
    .reduce((a, r) => a + inBase(r), 0)
  const firstLater = later[0]?.item.date

  return {
    due,
    dueCount: due.length,
    next,
    nextIn,
    nextOut,
    nextCaption: `+${formatMoney(nextIn, base)} · −${formatMoney(nextOut, base)}`,
    later,
    laterLabel: firstLater
      ? `Later in ${dateOf(firstLater).toLocaleString('en-US', { month: 'long' })}`
      : '',
    isEmpty: due.length + next.length + later.length === 0,
  }
}

// --- A goal's plan (1a) --------------------------------------------------------------

export type ContributionState = 'confirmed' | 'due' | 'future' | 'skipped'

export type ContributionEntry = {
  key: string
  state: ContributionState
  date: string
  /** In the goal's currency: a settlement's amount, or what is still open on a planned row. */
  amount: number
  source: 'transaction' | 'setAside' | 'planned'
  settlementId: string | null
  plannedId: string | null
  walletId: string | null
  externalLabel: string | null
  /** "Main Checking · confirmed", "Upcoming · needs confirming", "Upcoming". */
  caption: string
}

/** A run of equal future planned rows, collapsed: "Nov 1 – Feb 1 · Upcoming · 4 more". */
export type ContributionRun = {
  key: string
  state: 'future'
  from: string
  to: string
  count: number
  /** Each row's amount. */
  amount: number
  entries: ContributionEntry[]
}

/** A goal's or bill's stored plan next to what the engine makes of it today. */
export type PlanCompare = {
  /** What the user committed to (the snapshot on the owner); null before the first plan. */
  stored: {
    plannedAt: string
    amount: number
    count: number
    start: string | null
  } | null
  /** What the engine makes of it from today — exactly what a recalc would write. */
  live: PlanHeader
  /** `live.amount − stored.amount` — the drift a Recalculate would apply. */
  offBy: number
  /** The written rows a recalc would change, against what it would write. */
  rows: RowDrift
  /** A stored plan exists and today's numbers disagree with it, or with its rows. */
  isOffPlan: boolean
}

export function comparePlan(args: {
  owner: PlanOwner
  snapshot: PlanSnapshot
  desired: ReadonlyArray<DesiredPlanned>
  planned: ReadonlyArray<LocalPlanned>
  index: SettlementIndex
  rates: RatesMap
  today: string
}): PlanCompare {
  const fitted = fitPlanFrom(
    args.owner,
    args.desired,
    args.planned,
    args.index,
    args.rates,
    args.today,
  )
  const live = fitted.header
  const rows = rowDrift({
    owner: args.owner,
    writable: fitted.writable,
    existing: args.planned,
    today: args.today,
    isSettled: (row) => hasSettlements(row, args.index),
  })
  const { snapshot } = args
  const stored =
    snapshot.plannedAt !== null
      ? {
          plannedAt: snapshot.plannedAt,
          amount: snapshot.planAmount ?? 0,
          count: snapshot.planCount ?? 0,
          start: snapshot.planStart,
        }
      : null
  return {
    stored,
    live,
    offBy: stored ? live.amount - stored.amount : 0,
    rows,
    isOffPlan:
      stored !== null && (live.amount !== stored.amount || rows.differ),
  }
}

export type GoalPlanView = PlanCompare & {
  goalId: string
  currency: CurrencyCode
  behind: Behind & {
    kind: 'behind' | 'ahead' | 'on_plan'
    /** What the band leads with: something skipped, or something unconfirmed. */
    reason: 'skipped' | 'unconfirmed' | null
    oldestDue: LocalPlanned | null
  }
  progress: {
    /** Live set-asides plus what was used from the goal. */
    saved: number
    /** Σ still open on rows that are due — the striped segment. */
    awaiting: number
    /** The goal's target; 0 for a goal without one. */
    target: number
    left: number
    /** Live set-asides alone. */
    setAside: number
  }
  nextPlanned: LocalPlanned | null
  contributions: ContributionEntry[]
}

export type GoalPlanInput = {
  goal: LocalGoal
  planned: ReadonlyArray<LocalPlanned>
  /** What the live plan would generate today (the planner's `desired`). */
  desired: ReadonlyArray<DesiredPlanned>
  txns: ReadonlyArray<LocalTransaction>
  setAsides: ReadonlyArray<LocalSetAside>
  progress: GoalProgress | undefined
  nodes: ReadonlyArray<LocalBalanceNode>
  index: SettlementIndex
  rates: RatesMap
  today: string
}

export function buildGoalPlanView(input: GoalPlanInput): GoalPlanView {
  const { goal, index, rates, today } = input
  const mine = input.planned.filter(
    (p) => p.deleted === 0 && p.goalId === goal.id,
  )
  const inGoal = (amount: number, currency: CurrencyCode) =>
    convertMinor(amount, currency, goal.currency, rates)
  const wallets = new Map(
    input.nodes.filter((n) => n.kind === 'wallet').map((n) => [n.id, n.name]),
  )

  // Exactly what a recalc would write today — so after one, stored and live agree.
  const compare = comparePlan({
    owner: goalOwner(goal.id),
    snapshot: goal,
    desired: input.desired,
    planned: input.planned,
    index,
    rates,
    today,
  })

  const behind = behindOf(goalOwner(goal.id), mine, index, rates, today)
  const awaiting = mine
    .filter((p) => p.status === 'open' && p.date <= today)
    .reduce((a, p) => a + inGoal(remainderOf(p, index, rates), p.currency), 0)
  const saved = input.progress?.progress ?? 0
  const target = goal.target ?? 0

  const contributions: ContributionEntry[] = []
  for (const t of input.txns) {
    if (t.deleted !== 0 || t.goalId !== goal.id || t.type !== 'spend') continue
    contributions.push({
      key: `t:${t.id}`,
      state: 'confirmed',
      date: t.date,
      amount: inGoal(t.amount, t.currency),
      source: 'transaction',
      settlementId: t.id,
      plannedId: t.plannedId,
      walletId: t.walletId,
      externalLabel: null,
      caption: `${wallets.get(t.walletId) ?? 'Deleted account'} · confirmed`,
    })
  }
  for (const a of input.setAsides) {
    if (a.deleted !== 0 || a.goalId !== goal.id) continue
    const from =
      a.source === 'outside'
        ? (a.externalLabel ?? 'Outside')
        : (wallets.get(a.walletId ?? '') ?? 'Deleted account')
    contributions.push({
      key: `a:${a.id}`,
      state: 'confirmed',
      date: a.date,
      amount: inGoal(a.amount, a.currency),
      source: 'setAside',
      settlementId: a.id,
      plannedId: a.plannedId,
      walletId: a.source === 'wallet' ? a.walletId : null,
      externalLabel: a.source === 'outside' ? a.externalLabel : null,
      caption: `${from} · confirmed`,
    })
  }
  for (const p of mine) {
    if (p.status === 'done') continue
    const state: ContributionState =
      p.status === 'skipped' ? 'skipped' : p.date <= today ? 'due' : 'future'
    contributions.push({
      key: `p:${p.id}`,
      state,
      date: p.date,
      amount: inGoal(
        p.status === 'open' ? remainderOf(p, index, rates) : p.amount,
        p.currency,
      ),
      source: 'planned',
      settlementId: null,
      plannedId: p.id,
      walletId: p.walletId,
      externalLabel: null,
      caption:
        state === 'due'
          ? 'Upcoming · needs confirming'
          : state === 'skipped'
            ? 'Upcoming · skipped'
            : 'Upcoming',
    })
  }
  contributions.sort(
    (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
  )

  const oldestDue = behind.unconfirmed[0] ?? null
  return {
    goalId: goal.id,
    currency: goal.currency,
    ...compare,
    behind: {
      ...behind,
      kind:
        behind.behind > 0 ? 'behind' : behind.behind < 0 ? 'ahead' : 'on_plan',
      reason:
        behind.behind <= 0
          ? null
          : behind.skipped.length > 0
            ? 'skipped'
            : 'unconfirmed',
      oldestDue,
    },
    progress: {
      saved,
      awaiting,
      target,
      left: Math.max(0, target - saved),
      setAside: input.progress?.setAside ?? 0,
    },
    nextPlanned:
      mine
        .filter((p) => p.status === 'open' && p.date > today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    contributions,
  }
}

/**
 * Collapse consecutive future rows of the same amount into one run (the design's
 * "Nov 1 – Feb 1 · Upcoming · 4 more"). The first of a run stays on its own line.
 */
export function collapseContributions(
  entries: ReadonlyArray<ContributionEntry>,
): Array<ContributionEntry | ContributionRun> {
  const out: Array<ContributionEntry | ContributionRun> = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    let j = i + 1
    if (e.state === 'future') {
      while (
        j < entries.length &&
        entries[j].state === 'future' &&
        entries[j].amount === e.amount
      )
        j += 1
    }
    const run = entries.slice(i, j)
    if (run.length > 2) {
      out.push(e)
      const rest = run.slice(1)
      out.push({
        key: `run:${rest[0].key}`,
        state: 'future',
        from: rest[0].date,
        to: rest[rest.length - 1].date,
        count: rest.length,
        amount: e.amount,
        entries: rest,
      })
    } else {
      out.push(...run)
    }
    i = j
  }
  return out
}

/** Everything a transaction settling `item` would see: what is already in, what is left. */
export function matchSummary(
  item: LocalPlanned,
  index: SettlementIndex,
  rates: RatesMap,
): { settled: number; remainder: number; settlements: number } {
  const settled = settledOf(item, index, rates)
  return {
    settled,
    remainder: Math.max(0, item.amount - settled),
    settlements: settlementsFor(item, index).length,
  }
}
