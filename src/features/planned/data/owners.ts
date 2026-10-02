/**
 * Whose stored plan a planned set-aside belongs to: a goal's or a bill's. Both keep a plan
 * header on their own row and are rewritten only by a recalc, so the planner treats them alike.
 */
import type { LocalPlanned } from '#/db/types'

export type PlanOwner = { kind: 'goal' | 'bill'; id: string }

/** `goal:<id>` / `bill:<id>` — one key space for both kinds. */
export const ownerKey = (owner: PlanOwner): string =>
  `${owner.kind}:${owner.id}`

export const goalOwner = (id: string): PlanOwner => ({ kind: 'goal', id })
export const billOwner = (id: string): PlanOwner => ({ kind: 'bill', id })

/** The owner a row is linked to (a goal or a bill), whatever its origin. */
export function ownerOfRow(
  row: Pick<LocalPlanned, 'goalId' | 'billId'>,
): PlanOwner | null {
  if (row.billId) return billOwner(row.billId)
  if (row.goalId) return goalOwner(row.goalId)
  return null
}

/** A set-aside the generator made for this owner — part of its stored plan. */
export const isPlanRowOf = (
  row: Pick<LocalPlanned, 'origin' | 'role' | 'goalId' | 'billId'>,
  owner: PlanOwner,
): boolean =>
  row.role === 'set_aside' &&
  row.origin === owner.kind &&
  (owner.kind === 'goal' ? row.goalId : row.billId) === owner.id

/** Any set-aside linked to this owner, generated or hand-made. */
export const isSetAsideFor = (
  row: Pick<LocalPlanned, 'role' | 'goalId' | 'billId'>,
  owner: PlanOwner,
): boolean =>
  row.role === 'set_aside' &&
  (owner.kind === 'goal' ? row.goalId : row.billId) === owner.id

/** The plan-owner key of a generated set-aside, or null for any other row. */
export const planKeyOfRow = (
  row: Pick<LocalPlanned, 'origin' | 'role' | 'goalId' | 'billId'>,
): string | null => {
  if (row.role !== 'set_aside') return null
  if (row.origin === 'goal' && row.goalId)
    return ownerKey(goalOwner(row.goalId))
  if (row.origin === 'bill' && row.billId)
    return ownerKey(billOwner(row.billId))
  return null
}
