/**
 * The planned rows the user's goals, income streams and recurring schedules call for right
 * now — pure, and deterministic down to the ids, so every device derives the same rows.
 */
import type {
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
  LocalRecurring,
} from '#/db/types'
import {
  approxCyclesBetween,
  cycleMonthsOf,
  frequencyMetaOf,
  stepDue,
} from '#/features/goals/data/cadence'
import type { Repeat } from '#/features/goals/data/cadence'
import { clampSetAsideDay, datedSchedule } from '#/features/goals/data/planning'
import { paydaysOf } from '#/features/goals/data/paydays'
import type { GoalPlanEntry, GoalsPlan } from '#/features/goals/data/selectors'
import type { PlannedOrigin, PlannedRole } from '#/features/planned/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { advanceDue } from '#/features/transactions/data/planning'
import { addDaysISO, dateOf, isoOf } from './dates'
import { plannedIdFor } from './ids'
import { legacyMarkerOf } from './settle'

export { paydaysOf }

/** A row as the generator wants it; persistence adds the timestamps and sync fields. */
export type DesiredPlanned = Omit<
  LocalPlanned,
  'createdAt' | 'updatedAt' | 'version' | 'dirty' | 'deleted'
>

export type GeneratorInput = {
  userId: string
  goals: ReadonlyArray<LocalGoal>
  income: ReadonlyArray<LocalIncomeStream>
  recurrings: ReadonlyArray<LocalRecurring>
  /** The live plan (`planGoals`) over the same goals. */
  plan: GoalsPlan
  base: CurrencyCode
  rates: RatesMap
  today: Date
  horizonDays?: number
  /** `recurring:<id>:<date>` sources already in the ledger — occurrences posted before. */
  legacyMarkers?: ReadonlySet<string>
}

/** How far ahead rolling origins (paydays, bills, open-ended funds) are planned. */
export const HORIZON_DAYS = 90

/** A schedule never walks back further than this many occurrences. */
const MAX_CATCH_UP = 60

/** How far back a schedule the user confirms by hand still produces a due row. */
const MANUAL_LOOKBACK_DAYS = 31

type RowSeed = {
  origin: PlannedOrigin
  originId: string
  role: PlannedRole
  occurrence: string
  amount: number
  currency: CurrencyCode
  name: string
  walletId?: string | null
  categoryId?: string | null
  done?: boolean
}

const rowFor = (userId: string, seed: RowSeed): DesiredPlanned => ({
  id: plannedIdFor(
    userId,
    seed.origin,
    seed.originId,
    seed.role,
    seed.occurrence,
  ),
  origin: seed.origin,
  role: seed.role,
  goalId: seed.origin === 'goal' ? seed.originId : null,
  incomeStreamId: seed.origin === 'income' ? seed.originId : null,
  recurringId: seed.origin === 'recurring' ? seed.originId : null,
  walletId: seed.walletId ?? null,
  name: seed.name,
  amount: Math.max(0, Math.round(seed.amount)),
  currency: seed.currency,
  categoryId: seed.categoryId ?? null,
  occurrence: seed.occurrence,
  date: seed.occurrence,
  status: seed.done ? 'done' : 'open',
  pinned: false,
  note: null,
})

/** A goal's set-asides roll forward within the horizon unless its whole plan is finite. */
export const isFinitePlan = (goal: LocalGoal): boolean =>
  goal.kind === 'onetime'

/** Recurring obligations are paid each cycle; everything else only saves. */
const paysEachCycle = (goal: LocalGoal): boolean => goal.kind === 'recurring'

/** Occurrences of a schedule anchored on `first`, stepping as the Spending schedules do. */
function occurrencesFrom(
  first: string,
  repeat: Repeat,
  from: string,
  to: string,
): string[] {
  const out: string[] = []
  let at = first
  let guard = 0
  while (at < from && guard < 5_000) {
    at = advanceDue(at, repeat)
    guard += 1
  }
  while (at <= to && out.length < MAX_CATCH_UP) {
    out.push(at)
    at = advanceDue(at, repeat)
  }
  return out
}

/** A goal's dues from `from` through `to`, stepped from its `nextDue` without drift. */
function goalDuesFrom(
  goal: LocalGoal,
  nextDue: string,
  from: string,
  to: string,
): string[] {
  const { cadence } = frequencyMetaOf(goal, 'monthly')
  const anchor = dateOf(nextDue)
  const dueAt = (n: number) => isoOf(stepDue(anchor, cadence, n))
  let n = Math.max(0, approxCyclesBetween(anchor, dateOf(from), cadence) - 1)
  while (dueAt(n) < from) n += 1
  const out: string[] = []
  for (; dueAt(n) <= to && out.length < MAX_CATCH_UP; n += 1) out.push(dueAt(n))
  return out
}

function goalRows(
  entry: GoalPlanEntry,
  input: GeneratorInput,
  until: string,
): RowSeed[] {
  const { goal, plan } = entry
  const today = isoOf(input.today)
  const inGoal = (baseMinor: number) =>
    convertMinor(baseMinor, input.base, goal.currency, input.rates)
  const seeds: RowSeed[] = []

  const dated = datedSchedule(
    plan.schedule,
    input.today,
    clampSetAsideDay(goal.setAsideDay),
  )
  const wantsSetAsides =
    goal.kind !== 'recurring' || cycleMonthsOf(frequencyMetaOf(goal)) > 1
  const setAsides = wantsSetAsides
    ? dated
        .filter((d) => d.amount > 0.5)
        .filter((d) => isFinitePlan(goal) || d.date <= until)
        .map((d) => ({ date: d.date, amount: Math.round(inGoal(d.amount)) }))
    : []

  // A finite plan that finishes must add up to exactly what is left, whatever the rounding.
  if (isFinitePlan(goal) && plan.completesIn !== null && setAsides.length > 0) {
    const left = Math.max(0, (goal.target ?? 0) - goal.saved)
    const others = setAsides.slice(0, -1).reduce((sum, s) => sum + s.amount, 0)
    const last = left - others
    if (last > 0) setAsides[setAsides.length - 1].amount = last
  }

  for (const s of setAsides) {
    seeds.push({
      origin: 'goal',
      originId: goal.id,
      role: 'set_aside',
      occurrence: s.date,
      amount: s.amount,
      currency: goal.currency,
      name: `${goal.name} set-aside`,
    })
  }

  if (paysEachCycle(goal) && goal.nextDue && (goal.amount ?? 0) > 0) {
    for (const due of goalDuesFrom(goal, goal.nextDue, today, until)) {
      seeds.push({
        origin: 'goal',
        originId: goal.id,
        role: 'payment',
        occurrence: due,
        amount: goal.amount ?? 0,
        currency: goal.currency,
        name: goal.name,
      })
    }
  }
  return seeds
}

/** The final payment of a one-time obligation — owed whether or not the saving is done. */
function payOnDueRow(goal: LocalGoal): RowSeed | null {
  if (goal.kind !== 'onetime' || !goal.payOnDue || !goal.dueDate) return null
  if ((goal.target ?? 0) <= 0) return null
  return {
    origin: 'goal',
    originId: goal.id,
    role: 'payment',
    occurrence: goal.dueDate,
    amount: goal.target ?? 0,
    currency: goal.currency,
    name: goal.name,
  }
}

function incomeRows(
  stream: LocalIncomeStream,
  from: string,
  to: string,
): RowSeed[] {
  return paydaysOf(stream, from, to).map((date) => ({
    origin: 'income',
    originId: stream.id,
    role: 'income',
    occurrence: date,
    amount: stream.amount,
    currency: stream.currency,
    name: stream.label,
    walletId: stream.walletId,
  }))
}

function recurringRows(
  r: LocalRecurring,
  today: string,
  until: string,
  legacy: ReadonlySet<string>,
): RowSeed[] {
  // Auto-posted schedules catch up on everything missed, as the old auto-poster did; one
  // confirmed by hand only surfaces the recent past, not years of a stale `nextDue`.
  const from = r.autopost
    ? '0000-01-01'
    : addDaysISO(today, -MANUAL_LOOKBACK_DAYS)
  const to = r.endsOn && r.endsOn < until ? r.endsOn : until
  return occurrencesFrom(r.nextDue, r, from, to).map((date) => ({
    origin: 'recurring',
    originId: r.id,
    role: r.type === 'income' ? 'income' : 'payment',
    occurrence: date,
    amount: r.amount,
    currency: r.currency,
    name: r.name,
    walletId: r.walletId,
    categoryId: r.categoryId,
    done: legacy.has(legacyMarkerOf(r.id, date)),
  }))
}

export function desiredPlanned(input: GeneratorInput): DesiredPlanned[] {
  const today = isoOf(input.today)
  const until = addDaysISO(today, input.horizonDays ?? HORIZON_DAYS)
  const seeds: RowSeed[] = []
  for (const entry of input.plan.entries)
    seeds.push(...goalRows(entry, input, until))
  for (const goal of input.goals) {
    const payment = payOnDueRow(goal)
    if (payment) seeds.push(payment)
  }
  for (const stream of input.income)
    seeds.push(...incomeRows(stream, today, until))
  for (const r of input.recurrings)
    seeds.push(
      ...recurringRows(r, today, until, input.legacyMarkers ?? new Set()),
    )
  return seeds.map((seed) => rowFor(input.userId, seed))
}
