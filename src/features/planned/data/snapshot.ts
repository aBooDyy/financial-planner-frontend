/**
 * The headline of a goal's plan — "SR 1,500/mo × 8 from Jul 1" — read off planned rows.
 * The stored plan's copy lives on the goal (written when the plan is saved); the live one is
 * read off the rows the plan would generate today, so the two compare like for like.
 */
import type { LocalGoal, LocalPlanned } from '#/db/types'
import type { GoalPlanSnapshot } from '#/features/goals/data/mutations'

type PlanRow = Pick<
  LocalPlanned,
  'role' | 'amount' | 'occurrence' | 'goalId' | 'origin'
>

export type PlanHeader = {
  /** The steady per-set-aside amount (the largest, for a ramped plan). */
  amount: number
  /** How many set-asides. */
  count: number
  /** The first set-aside's date, or null when there are none. */
  start: string | null
  /** The last set-aside's date, or null when there are none. */
  end: string | null
}

/**
 * The header of the plan one goal's rows describe, from `from` on. A bill paid each cycle
 * with no set-asides headlines its payment instead, with a count of zero.
 */
export function planHeaderOf(
  goalId: string,
  rows: ReadonlyArray<PlanRow>,
  from: string,
): PlanHeader {
  const mine = rows.filter(
    (r) => r.origin === 'goal' && r.goalId === goalId && r.occurrence >= from,
  )
  const setAsides = mine
    .filter((r) => r.role === 'set_aside' && r.amount > 0)
    .sort((a, b) => a.occurrence.localeCompare(b.occurrence))
  if (setAsides.length > 0) {
    return {
      amount: Math.max(...setAsides.map((r) => r.amount)),
      count: setAsides.length,
      start: setAsides[0].occurrence,
      end: setAsides[setAsides.length - 1].occurrence,
    }
  }
  const payments = mine.filter((r) => r.role === 'payment')
  return {
    amount: payments.reduce((mx, r) => Math.max(mx, r.amount), 0),
    count: 0,
    start: null,
    end: null,
  }
}

export const snapshotOf = (
  header: PlanHeader,
  today: string,
): GoalPlanSnapshot => ({
  plannedAt: today,
  planAmount: header.amount,
  planCount: header.count,
  planStart: header.start,
})

export const snapshotFromGoal = (goal: LocalGoal): GoalPlanSnapshot => ({
  plannedAt: goal.plannedAt,
  planAmount: goal.planAmount,
  planCount: goal.planCount,
  planStart: goal.planStart,
})
