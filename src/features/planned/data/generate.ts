/**
 * The planned rows the user's goals and income streams call for right now — pure, and
 * deterministic down to the ids, so every device derives the same rows.
 *
 * Interim: bills generate nothing yet; their occurrences, coverage set-asides and payments
 * come with the bills engine.
 */
import type { LocalGoal, LocalIncomeStream, LocalPlanned } from '#/db/types'
import type {
  GoalPlanEntry,
  GoalsPlan,
} from '#/features/goals/data/fundingPlan'
import { isDatedGoal } from '#/features/goals/data/fundingPlan'
import { clampSetAsideDay, datedSchedule } from '#/features/goals/data/planning'
import { paydaysOf } from '#/features/goals/data/paydays'
import type { PlannedOrigin, PlannedRole } from '#/features/planned/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { addDaysISO, isoOf } from './dates'
import { plannedIdFor } from './ids'

export { paydaysOf }

/** A row as the generator wants it; persistence adds the timestamps and sync fields. */
export type DesiredPlanned = Omit<
  LocalPlanned,
  'createdAt' | 'updatedAt' | 'version' | 'dirty' | 'deleted'
>

export type GeneratorInput = {
  userId: string
  income: ReadonlyArray<LocalIncomeStream>
  /** The live plan (`planGoals`). */
  plan: GoalsPlan
  base: CurrencyCode
  rates: RatesMap
  today: Date
  horizonDays?: number
}

/** How far ahead rolling origins (paydays, open-ended goals) are planned. */
export const HORIZON_DAYS = 90

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
  billId: seed.origin === 'bill' ? seed.originId : null,
  walletId: seed.walletId ?? null,
  name: seed.name,
  amount: Math.max(0, Math.round(seed.amount)),
  currency: seed.currency,
  categoryId: seed.categoryId ?? null,
  occurrence: seed.occurrence,
  date: seed.occurrence,
  status: 'open',
  pinned: false,
  review: false,
  note: null,
})

/**
 * A dated goal with a target has a whole, finite plan (its stored plan); anything else rolls
 * forward within the horizon.
 */
export const isFinitePlan = (goal: LocalGoal): boolean =>
  isDatedGoal(goal) && (goal.target ?? 0) > 0

function goalRows(
  entry: GoalPlanEntry,
  input: GeneratorInput,
  until: string,
): RowSeed[] {
  const { goal, plan } = entry
  const inGoal = (baseMinor: number) =>
    convertMinor(baseMinor, input.base, goal.currency, input.rates)

  const setAsides = datedSchedule(
    plan.schedule,
    input.today,
    clampSetAsideDay(goal.setAsideDay),
  )
    .filter((d) => d.amount > 0.5)
    .filter((d) => isFinitePlan(goal) || d.date <= until)
    .map((d) => ({ date: d.date, amount: Math.round(inGoal(d.amount)) }))

  // A finite plan that finishes must add up to exactly what is left, whatever the rounding.
  if (isFinitePlan(goal) && plan.completesIn !== null && setAsides.length > 0) {
    const left = Math.max(0, (goal.target ?? 0) - entry.saved)
    const others = setAsides.slice(0, -1).reduce((sum, s) => sum + s.amount, 0)
    const last = left - others
    if (last > 0) setAsides[setAsides.length - 1].amount = last
  }

  return setAsides.map((s) => ({
    origin: 'goal',
    originId: goal.id,
    role: 'set_aside',
    occurrence: s.date,
    amount: s.amount,
    currency: goal.currency,
    name: `${goal.name} set-aside`,
    walletId: goal.saveWalletId,
  }))
}

function incomeRows(
  stream: LocalIncomeStream,
  from: string,
  to: string,
): RowSeed[] {
  const until = stream.endsOn && stream.endsOn < to ? stream.endsOn : to
  return paydaysOf(stream, from, until).map((date) => ({
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

export function desiredPlanned(input: GeneratorInput): DesiredPlanned[] {
  const today = isoOf(input.today)
  const until = addDaysISO(today, input.horizonDays ?? HORIZON_DAYS)
  const seeds: RowSeed[] = []
  for (const entry of input.plan.entries)
    seeds.push(...goalRows(entry, input, until))
  for (const stream of input.income)
    seeds.push(...incomeRows(stream, today, until))
  return seeds.map((seed) => rowFor(input.userId, seed))
}
