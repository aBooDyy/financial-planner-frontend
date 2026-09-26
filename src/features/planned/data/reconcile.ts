/**
 * The difference between the rows the plan calls for and the rows that exist, as a set of
 * writes. Pure. What may change is narrow on purpose — the stored plan moves only when the
 * user asks it to:
 *
 * - A row that is done, skipped, pinned, settled (even partly) or already due is never
 *   touched. The backlog stays for the user to confirm or skip.
 * - `fill` (the background run) creates what is missing and drops future rows an origin no
 *   longer produces — a bill's cycle that moved, a payday that changed. It never rewrites a
 *   goal's set-asides: a one-time goal's stored plan is left exactly as saved, and a rolling
 *   one (open-ended, sinking, a long-cycle bill) only grows at its far end.
 * - `recalc` (one goal, on request) rewrites that goal's future rows to the live plan.
 * - Paydays and Spending schedules have no stored plan; their future rows follow the
 *   stream / schedule as it is now.
 * - An origin that is gone takes its future unsettled open rows with it; history stays.
 */
import type { LocalGoal, LocalPlanned } from '#/db/types'
import type { DesiredPlanned } from './generate'
import { isFinitePlan } from './generate'
import { isRewritable } from './fit'

export type ReconcileMode = 'fill' | 'recalc'

export type ReconcileContext = {
  /** ISO date; rows on or before it are the past. */
  today: string
  mode: ReconcileMode
  /** `recalc` only: the goal whose plan is rewritten. */
  goalId?: string
  isSettled: (row: LocalPlanned) => boolean
  /** Every live goal, by id. */
  goals: ReadonlyMap<string, LocalGoal>
  /** Goals still in the live plan — a completed goal needs no more set-asides. */
  activeGoalIds: ReadonlySet<string>
  incomeIds: ReadonlySet<string>
  recurringIds: ReadonlySet<string>
  /** `fill` leaves these goals alone (the caller rewrites them with `recalc`). */
  skipGoalIds?: ReadonlySet<string>
}

export type PlannedPatch = Partial<
  Pick<LocalPlanned, 'amount' | 'walletId' | 'name' | 'categoryId' | 'date'>
>

export type ReconcilePlan = {
  create: DesiredPlanned[]
  update: Array<{ id: string; patch: PlannedPatch }>
  remove: string[]
}

const PATCHABLE = [
  'amount',
  'walletId',
  'name',
  'categoryId',
] as const satisfies ReadonlyArray<keyof PlannedPatch>

const diff = (row: LocalPlanned, want: DesiredPlanned): PlannedPatch | null => {
  const patch: PlannedPatch = {}
  for (const field of PATCHABLE) {
    if (row[field] !== want[field])
      Object.assign(patch, { [field]: want[field] })
  }
  return Object.keys(patch).length > 0 ? patch : null
}

export function reconcilePlanned(
  desired: ReadonlyArray<DesiredPlanned>,
  existing: ReadonlyArray<LocalPlanned>,
  ctx: ReconcileContext,
): ReconcilePlan {
  const plan: ReconcilePlan = { create: [], update: [], remove: [] }
  const rows = existing.filter((p) => p.deleted === 0 && p.origin !== 'manual')
  const held = new Map(rows.map((p) => [p.id, p]))

  /** Future, still open, unsettled — the only rows anything here may remove. */
  const removable = (p: LocalPlanned) =>
    p.status === 'open' && p.occurrence > ctx.today && !ctx.isSettled(p)
  /** …and not edited by hand — the only rows anything here may rewrite. */
  const rewritable = (p: LocalPlanned) =>
    isRewritable(p, ctx.today, ctx.isSettled)

  if (ctx.mode === 'recalc') {
    const goalId = ctx.goalId
    const wanted = desired.filter(
      (d) => d.origin === 'goal' && d.goalId === goalId,
    )
    const wantedIds = new Set(wanted.map((d) => d.id))
    for (const p of rows) {
      if (p.origin !== 'goal' || p.goalId !== goalId || !rewritable(p)) continue
      if (!wantedIds.has(p.id)) plan.remove.push(p.id)
    }
    for (const d of wanted) {
      const row = held.get(d.id)
      if (!row) {
        if (d.occurrence >= ctx.today) plan.create.push(d)
        continue
      }
      if (!rewritable(row)) continue
      const patch = diff(row, d)
      if (patch) plan.update.push({ id: row.id, patch })
    }
    return plan
  }

  // --- fill -------------------------------------------------------------------------

  const originGone = (p: LocalPlanned): boolean => {
    if (p.origin === 'goal') return !p.goalId || !ctx.goals.has(p.goalId)
    if (p.origin === 'income')
      return !p.incomeStreamId || !ctx.incomeIds.has(p.incomeStreamId)
    return !p.recurringId || !ctx.recurringIds.has(p.recurringId)
  }
  const skipped = (goalId: string | null) =>
    !!goalId && (ctx.skipGoalIds?.has(goalId) ?? false)

  // The furthest set-aside each goal already has: rolling plans only grow past it.
  const lastSetAside = new Map<string, string>()
  for (const p of rows) {
    if (p.origin !== 'goal' || p.role !== 'set_aside' || !p.goalId) continue
    const prev = lastSetAside.get(p.goalId)
    if (!prev || p.occurrence > prev) lastSetAside.set(p.goalId, p.occurrence)
  }

  const wantedIds = new Set(desired.map((d) => d.id))

  for (const p of rows) {
    if (skipped(p.goalId)) continue
    if (originGone(p)) {
      if (removable(p)) plan.remove.push(p.id)
      continue
    }
    if (wantedIds.has(p.id) || !rewritable(p)) continue
    // Set-asides leave a stored plan only once the goal no longer needs any; a payment or
    // payday the origin stopped producing is simply stale.
    const storedSetAside = p.origin === 'goal' && p.role === 'set_aside'
    if (!storedSetAside || !ctx.activeGoalIds.has(p.goalId ?? ''))
      plan.remove.push(p.id)
  }

  for (const d of desired) {
    if (skipped(d.goalId)) continue
    const row = held.get(d.id)
    if (row) {
      if (d.origin !== 'goal' && rewritable(row)) {
        const patch = diff(row, d)
        if (patch) plan.update.push({ id: row.id, patch })
      }
      continue
    }
    if (d.origin === 'goal' && d.role === 'set_aside' && d.goalId) {
      const goal = ctx.goals.get(d.goalId)
      if (!goal || isFinitePlan(goal)) {
        // A finite plan is written whole, once; afterwards only a recalc changes it.
        if (lastSetAside.has(d.goalId)) continue
      } else {
        const last = lastSetAside.get(d.goalId)
        if (last && d.occurrence <= last) continue
      }
    }
    if (d.occurrence < ctx.today && d.origin !== 'recurring') continue
    plan.create.push(d)
  }
  return plan
}

export type OrphanOrigins = {
  goalIds: ReadonlySet<string>
  incomeIds: ReadonlySet<string>
  recurringIds: ReadonlySet<string>
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
 * unless it is a set-aside whose goal is gone, which could never be confirmed.
 */
export function orphanedPlanned(
  rows: ReadonlyArray<LocalPlanned>,
  origins: OrphanOrigins,
  isSettled: (row: LocalPlanned) => boolean,
): OrphanPlan {
  const goalGone = (p: LocalPlanned) =>
    !p.goalId || !origins.goalIds.has(p.goalId)
  const gone = (p: LocalPlanned): boolean => {
    if (p.origin === 'goal') return goalGone(p)
    if (p.origin === 'income')
      return !p.incomeStreamId || !origins.incomeIds.has(p.incomeStreamId)
    if (p.origin === 'recurring')
      return !p.recurringId || !origins.recurringIds.has(p.recurringId)
    return p.role === 'set_aside' && goalGone(p)
  }
  const plan: OrphanPlan = { skip: [], closeRest: [] }
  for (const p of rows) {
    if (p.deleted !== 0 || p.status !== 'open' || !gone(p)) continue
    ;(isSettled(p) ? plan.closeRest : plan.skip).push(p.id)
  }
  return plan
}
