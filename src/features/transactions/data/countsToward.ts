/**
 * The TxEditor's "Counts toward" choices (1e): the goals and obligations a spend can pay, or
 * the income streams an income entry can be the payday of — the most relevant first.
 */
import type { LocalGoal, LocalIncomeStream, LocalPlanned } from '#/db/types'
import { FREQUENCIES } from '#/features/goals/constants'
import { shortDate } from '#/features/planned/data/views'
import { formatMoneyRounded } from '#/lib/currency'

export type CountsKind = 'goal' | 'obligation' | 'income'

export type CountsOption = {
  id: string
  name: string
  /** "Goal · SR 4,000 of 13,000" / "Obligation · SR 3,500 due Oct 1" / "Income · SR 12,000 monthly". */
  sub: string
  color: string
  kind: CountsKind
}

export type RankedOptions = { top: CountsOption[]; rest: CountsOption[] }

export const TOP_OPTIONS = 5
/** An origin with an open planned item this close to the entry's date ranks first. */
export const RELEVANT_DAYS = 30

const DAY_MS = 86_400_000
/** Whole days between two ISO dates, either order. */
export const daysApart = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS

/** Days from `date` to each origin's nearest open planned item within the window. */
function nearestOpen(
  planned: ReadonlyArray<LocalPlanned>,
  date: string,
  originOf: (p: LocalPlanned) => string | null,
  keep: (p: LocalPlanned) => boolean = () => true,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of planned) {
    if (p.deleted !== 0 || p.status !== 'open' || !keep(p)) continue
    const origin = originOf(p)
    if (!origin) continue
    const d = daysApart(p.date, date)
    if (d > RELEVANT_DAYS) continue
    const best = out.get(origin)
    if (best === undefined || d < best) out.set(origin, d)
  }
  return out
}

function rank<T extends { id: string; position: number }>(
  items: ReadonlyArray<T>,
  near: Map<string, number>,
): T[] {
  return [...items].sort((a, b) => {
    const da = near.get(a.id)
    const db = near.get(b.id)
    if (da !== undefined && db !== undefined) return da - db
    if (da !== undefined) return -1
    if (db !== undefined) return 1
    return a.position - b.position
  })
}

/** The chosen option always shows, even when it would otherwise sit under "More…". */
function split(
  options: CountsOption[],
  selectedId: string | null,
): RankedOptions {
  const top = options.slice(0, TOP_OPTIONS)
  const rest = options.slice(TOP_OPTIONS)
  const picked = rest.find((o) => o.id === selectedId)
  return picked
    ? { top: [...top, picked], rest: rest.filter((o) => o !== picked) }
    : { top, rest }
}

export function goalOption(goal: LocalGoal, saved: number): CountsOption {
  const money = (n: number) => formatMoneyRounded(n, goal.currency)
  if (goal.kind === 'recurring') {
    return {
      id: goal.id,
      name: goal.name,
      sub: `Obligation · ${money(goal.amount ?? 0)}${goal.nextDue ? ` due ${shortDate(goal.nextDue)}` : ''}`,
      color: goal.color,
      kind: 'obligation',
    }
  }
  const target = goal.kind === 'sinking' ? goal.amount : goal.target
  return {
    id: goal.id,
    name: goal.name,
    sub: target
      ? `Goal · ${money(saved)} of ${money(target)}`
      : `Goal · ${money(saved)} saved`,
    color: goal.color,
    kind: 'goal',
  }
}

/**
 * Goals and obligations for a spend, in tiers: anything with an open planned *payment* near the
 * date (nearest first), then other obligations, then saving goals with a planned set-aside near
 * the date (nearest first), then the rest by position. `savedOf` is the goal's saved figure,
 * baseline included.
 */
export function rankGoalOptions(args: {
  goals: ReadonlyArray<LocalGoal>
  planned: ReadonlyArray<LocalPlanned>
  date: string
  savedOf: (goal: LocalGoal) => number
  selectedId: string | null
}): RankedOptions {
  const live = args.goals.filter((g) => g.deleted === 0)
  const payments = nearestOpen(
    args.planned,
    args.date,
    (p) => p.goalId,
    (p) => p.role === 'payment',
  )
  const near = nearestOpen(args.planned, args.date, (p) => p.goalId)
  // A spend only ever settles a payment, so a payment due soon outranks a set-aside due soon.
  const tierOf = (g: LocalGoal): number =>
    payments.has(g.id) ? 0 : !isSavingGoal(g) ? 1 : near.has(g.id) ? 2 : 3
  const ranked = [...live].sort((a, b) => {
    const ta = tierOf(a)
    const tb = tierOf(b)
    if (ta !== tb) return ta - tb
    const days = ta === 0 ? payments : near
    return (
      (days.get(a.id) ?? 0) - (days.get(b.id) ?? 0) || a.position - b.position
    )
  })
  return split(
    ranked.map((g) => goalOption(g, args.savedOf(g))),
    args.selectedId,
  )
}

/** Income streams for an income entry. */
export function rankIncomeOptions(args: {
  streams: ReadonlyArray<LocalIncomeStream>
  planned: ReadonlyArray<LocalPlanned>
  date: string
  selectedId: string | null
}): RankedOptions {
  const live = args.streams.filter((s) => s.deleted === 0)
  const near = nearestOpen(args.planned, args.date, (p) => p.incomeStreamId)
  return split(
    rank(live, near).map((s) => ({
      id: s.id,
      name: s.label,
      sub: `Income · ${formatMoneyRounded(s.amount, s.currency)} ${FREQUENCIES[s.frequency].label.toLowerCase()}`,
      color: s.color,
      kind: 'income' as const,
    })),
    args.selectedId,
  )
}

/** A saving goal is funded by set-asides (reservations), not by spends. */
export const isSavingGoal = (goal: LocalGoal): boolean =>
  goal.kind !== 'recurring'
