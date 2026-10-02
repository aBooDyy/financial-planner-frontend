/**
 * The headline of a goal's or bill's plan — "SR 1,500 × 8 from Jul 25" — read off planned
 * rows. The stored plan's copy lives on the owner's row (written when the plan is saved); the
 * live one is read off the rows the plan would generate today, so the two compare like for
 * like.
 */
import type { LocalPlanned } from '#/db/types'
import { isPlanRowOf } from './owners'
import type { PlanOwner } from './owners'

type PlanRow = Pick<
  LocalPlanned,
  'role' | 'amount' | 'occurrence' | 'goalId' | 'billId' | 'origin'
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

/** The stored plan's header, as goals and bills both keep it on their own row. */
export type PlanSnapshot = {
  plannedAt: string | null
  planAmount: number | null
  planCount: number | null
  planStart: string | null
}

/** The header of the plan one owner's set-asides describe, from `from` on. */
export function planHeaderOf(
  owner: PlanOwner,
  rows: ReadonlyArray<PlanRow>,
  from: string,
): PlanHeader {
  const setAsides = rows
    .filter(
      (r) => isPlanRowOf(r, owner) && r.occurrence >= from && r.amount > 0,
    )
    .sort((a, b) => a.occurrence.localeCompare(b.occurrence))
  if (setAsides.length === 0)
    return { amount: 0, count: 0, start: null, end: null }
  return {
    amount: Math.max(...setAsides.map((r) => r.amount)),
    count: setAsides.length,
    start: setAsides[0].occurrence,
    end: setAsides[setAsides.length - 1].occurrence,
  }
}

export const snapshotOf = (
  header: PlanHeader,
  today: string,
): PlanSnapshot => ({
  plannedAt: today,
  planAmount: header.amount,
  planCount: header.count,
  planStart: header.start,
})

export const snapshotFrom = (item: PlanSnapshot): PlanSnapshot => ({
  plannedAt: item.plannedAt,
  planAmount: item.planAmount,
  planCount: item.planCount,
  planStart: item.planStart,
})
