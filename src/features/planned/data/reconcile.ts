/**
 * The difference between the rows the plan calls for and the rows that exist, as a set of
 * writes. Pure. What may change is narrow on purpose — a stored plan moves only when the
 * user (or a plan-changing edit) asks it to:
 *
 * - A row that is done, skipped, pinned, settled (even partly) or already due is never
 *   touched. The backlog stays for the user to confirm or skip.
 * - `fill` (the background run) creates what is missing and drops future rows an origin no
 *   longer produces — a payday or payment that moved. It never rewrites a goal's or a bill's
 *   set-asides (their stored plan): a dated goal's plan is written whole, once; any other plan
 *   only grows past its last set-aside. It does keep their review flag in line with the payday
 *   mode while they are still in the future.
 * - `recalc` (one goal or bill, on request) rewrites that owner's future set-asides to the
 *   live plan.
 * - Paydays and bill payments have no stored plan; their future rows follow the origin.
 * - An origin that is gone takes its future unsettled open rows with it; history stays.
 */
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { isDatedTargetGoal } from '#/features/planning/data/funding'
import type { DesiredPlanned } from './generate'
import { isRewritable } from './fit'
import { isPlanRowOf, planKeyOfRow } from './owners'
import type { PlanOwner } from './owners'

export type ReconcileMode = 'fill' | 'recalc'

export type ReconcileContext = {
  /** ISO date; rows on or before it are the past. */
  today: string
  mode: ReconcileMode
  /** `recalc` only: the goal or bill whose plan is rewritten. */
  owner?: PlanOwner
  isSettled: (row: LocalPlanned) => boolean
  /** Every live goal, by id. */
  goals: ReadonlyMap<string, LocalGoal>
  /** Goals and bills still being planned (`goal:<id>` / `bill:<id>`): they keep their rows. */
  activeOwners: ReadonlySet<string>
  incomeIds: ReadonlySet<string>
  billIds: ReadonlySet<string>
  /** `fill` leaves these owners' set-asides alone (the caller rewrites them with `recalc`). */
  skipOwners?: ReadonlySet<string>
}

export type PlannedPatch = Partial<
  Pick<
    LocalPlanned,
    'amount' | 'walletId' | 'name' | 'categoryId' | 'date' | 'review'
  >
>

export type ReconcilePlan = {
  create: DesiredPlanned[]
  update: Array<{ id: string; patch: PlannedPatch }>
  remove: string[]
}

type Field = keyof PlannedPatch

/** A row without a stored plan follows its origin. */
const FOLLOWS_ORIGIN: ReadonlyArray<Field> = [
  'amount',
  'walletId',
  'name',
  'categoryId',
]
/** A stored set-aside keeps its amounts; only its review flag follows the payday mode. */
const STORED_PLAN: ReadonlyArray<Field> = ['review']

const diff = (
  row: LocalPlanned,
  want: DesiredPlanned,
  fields: ReadonlyArray<Field>,
): PlannedPatch | null => {
  const patch: PlannedPatch = {}
  for (const field of fields) {
    if (row[field] !== want[field])
      Object.assign(patch, { [field]: want[field] })
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function recalcPlan(
  desired: ReadonlyArray<DesiredPlanned>,
  rows: ReadonlyArray<LocalPlanned>,
  ctx: ReconcileContext,
): ReconcilePlan {
  const plan: ReconcilePlan = { create: [], update: [], remove: [] }
  const owner = ctx.owner
  if (!owner) return plan
  const held = new Map(rows.map((p) => [p.id, p]))
  const rewritable = (p: LocalPlanned) =>
    isRewritable(p, ctx.today, ctx.isSettled)
  const wanted = desired.filter((d) => isPlanRowOf(d, owner))
  const wantedIds = new Set(wanted.map((d) => d.id))
  for (const p of rows) {
    if (!isPlanRowOf(p, owner) || !rewritable(p)) continue
    if (!wantedIds.has(p.id)) plan.remove.push(p.id)
  }
  for (const d of wanted) {
    const row = held.get(d.id)
    if (!row) {
      if (d.occurrence >= ctx.today) plan.create.push(d)
      continue
    }
    if (!rewritable(row)) continue
    const patch = diff(row, d, [...FOLLOWS_ORIGIN, ...STORED_PLAN])
    if (patch) plan.update.push({ id: row.id, patch })
  }
  return plan
}

export function reconcilePlanned(
  desired: ReadonlyArray<DesiredPlanned>,
  existing: ReadonlyArray<LocalPlanned>,
  ctx: ReconcileContext,
): ReconcilePlan {
  const rows = existing.filter((p) => p.deleted === 0 && p.origin !== 'manual')
  if (ctx.mode === 'recalc') return recalcPlan(desired, rows, ctx)

  const plan: ReconcilePlan = { create: [], update: [], remove: [] }
  const held = new Map(rows.map((p) => [p.id, p]))
  /** Future, still open, unsettled — the only rows anything here may remove. */
  const removable = (p: LocalPlanned) =>
    p.status === 'open' && p.occurrence > ctx.today && !ctx.isSettled(p)
  /** …and not edited by hand — the only rows anything here may rewrite. */
  const rewritable = (p: LocalPlanned) =>
    isRewritable(p, ctx.today, ctx.isSettled)

  const originGone = (p: LocalPlanned): boolean => {
    if (p.origin === 'goal') return !p.goalId || !ctx.goals.has(p.goalId)
    if (p.origin === 'income')
      return !p.incomeStreamId || !ctx.incomeIds.has(p.incomeStreamId)
    return !p.billId || !ctx.billIds.has(p.billId)
  }
  const skipped = (
    p: Pick<LocalPlanned, 'origin' | 'role' | 'goalId' | 'billId'>,
  ) => {
    const key = planKeyOfRow(p)
    return key !== null && (ctx.skipOwners?.has(key) ?? false)
  }

  // The furthest set-aside each plan already has: a rolling plan only grows past it.
  const lastSetAside = new Map<string, string>()
  for (const p of rows) {
    const key = planKeyOfRow(p)
    if (!key) continue
    const prev = lastSetAside.get(key)
    if (!prev || p.occurrence > prev) lastSetAside.set(key, p.occurrence)
  }

  const wantedIds = new Set(desired.map((d) => d.id))

  for (const p of rows) {
    if (skipped(p)) continue
    if (originGone(p)) {
      if (removable(p)) plan.remove.push(p.id)
      continue
    }
    if (wantedIds.has(p.id) || !rewritable(p)) continue
    // A stored set-aside leaves only once its owner needs no more; a payment or payday the
    // origin stopped producing is simply stale.
    const key = planKeyOfRow(p)
    if (!key || !ctx.activeOwners.has(key)) plan.remove.push(p.id)
  }

  for (const d of desired) {
    if (skipped(d)) continue
    const key = planKeyOfRow(d)
    const row = held.get(d.id)
    if (row) {
      if (rewritable(row)) {
        const patch = diff(row, d, key ? STORED_PLAN : FOLLOWS_ORIGIN)
        if (patch) plan.update.push({ id: row.id, patch })
      }
      continue
    }
    if (key) {
      const goal = d.goalId ? ctx.goals.get(d.goalId) : undefined
      const last = lastSetAside.get(key)
      // A dated goal's plan is written whole, once; afterwards only a recalc changes it.
      if (d.origin === 'goal' && (!goal || isDatedTargetGoal(goal))) {
        if (last) continue
      } else if (last && d.occurrence <= last) continue
    }
    // Only a bill's payment may arrive already due (it waits in Needs confirming).
    if (
      d.occurrence < ctx.today &&
      !(d.origin === 'bill' && d.role === 'payment')
    )
      continue
    plan.create.push(d)
  }
  return plan
}

export type OrphanOrigins = {
  goalIds: ReadonlySet<string>
  incomeIds: ReadonlySet<string>
  /** Each live bill's `nextDue`: an open payment dated before it is stale. */
  billNextDue: ReadonlyMap<string, string>
}

export type OrphanPlan = {
  /** Nothing settles them: skipped. */
  skip: string[]
  /** Partly settled: done, with the rest abandoned. */
  closeRest: string[]
}

/**
 * Open rows whose origin is gone would wait in "Needs confirming" forever for something that
 * no longer exists, so they are resolved instead: skipped when nothing settles them, closed
 * with the rest abandoned when something does. A hand-made row belongs to no origin and stays —
 * unless it is a set-aside whose goal or bill is gone, which could never be confirmed. A bill
 * payment dated before the bill's `nextDue` (the user moved the bill on past it) is stale too.
 */
export function orphanedPlanned(
  rows: ReadonlyArray<LocalPlanned>,
  origins: OrphanOrigins,
  isSettled: (row: LocalPlanned) => boolean,
): OrphanPlan {
  const goalGone = (p: LocalPlanned) =>
    !p.goalId || !origins.goalIds.has(p.goalId)
  const billGone = (p: LocalPlanned) =>
    !p.billId || !origins.billNextDue.has(p.billId)
  const stalePayment = (p: LocalPlanned) =>
    p.role === 'payment' &&
    p.occurrence < (origins.billNextDue.get(p.billId ?? '') ?? '')
  const gone = (p: LocalPlanned): boolean => {
    if (p.origin === 'goal') return goalGone(p)
    if (p.origin === 'income')
      return !p.incomeStreamId || !origins.incomeIds.has(p.incomeStreamId)
    if (p.origin === 'bill') return billGone(p) || stalePayment(p)
    return p.role === 'set_aside' && (p.billId ? billGone(p) : goalGone(p))
  }
  const plan: OrphanPlan = { skip: [], closeRest: [] }
  for (const p of rows) {
    if (p.deleted !== 0 || p.status !== 'open' || !gone(p)) continue
    ;(isSettled(p) ? plan.closeRest : plan.skip).push(p.id)
  }
  return plan
}
