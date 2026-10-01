/**
 * The planner: brings the stored planned rows in line with the goals and streams they come
 * from (`generate` → `reconcile` → writes), rewrites one goal's plan on request, and resolves
 * open rows whose origin is gone.
 *
 * Every entry point runs through one queue, so a background fill, a Recalculate click and
 * an undo can never interleave their reads and writes.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { DEFAULT_BASE_CURRENCY } from '#/features/goals/constants'
import { setGoalPlanSnapshot } from '#/features/goals/data/mutations'
import type { GoalPlanSnapshot } from '#/features/goals/data/mutations'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { isoOf } from './dates'
import { takePlanRecalcRequests } from './recalcRequests'
import { orphanedPlanned, reconcilePlanned } from './reconcile'
import type { ReconcileContext, ReconcilePlan } from './reconcile'
import {
  currentRates,
  insertPlanned,
  pendingPlanned,
  removePlanned,
  savePlanned,
} from './rows'
import { hasSettlements } from './settle'
import { fitGoalPlanFrom } from './fit'
import { linkedTransactions } from './linkedTransactions'
import { snapshotFromGoal, snapshotOf } from './snapshot'
import type { PlanHeader } from './snapshot'
import { derivePlannerState, liveInputs } from './state'
import type { PlannerInputs, PlannerState } from './state'

export type RecalcResult = {
  goalId: string
  /** ISO date of the rewrite. */
  at: string
  before: GoalPlanSnapshot
  after: GoalPlanSnapshot
  /** The rewritten plan from today on — e.g. 5 set-asides of 1,800, Oct 1 → Feb 1. */
  header: PlanHeader
  changed: { created: number; updated: number; removed: number }
  /** Restore the plan exactly as it was: same rows, same ids, same amounts. */
  undo: () => Promise<void>
}

export type PlannerRunSummary = {
  created: number
  updated: number
  removed: number
  rewritten: string[]
  /** Open rows whose origin is gone: skipped, or closed with the rest abandoned. */
  orphansResolved: number
}

let queue: Promise<unknown> = Promise.resolve()

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

export async function loadPlannerInputs(): Promise<PlannerInputs> {
  const [goals, income, bills, planned, txns, setAsides, settings] =
    await Promise.all([
      db.goals.toArray(),
      db.incomeStreams.toArray(),
      db.bills.toArray(),
      db.plannedTransactions.toArray(),
      linkedTransactions(),
      db.setAsides.toArray(),
      db.balanceSettings.get(SETTINGS_KEY),
    ])
  return liveInputs({
    goals,
    income,
    bills,
    planned,
    txns,
    setAsides,
    base: settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY,
    rates: await currentRates(),
  })
}

const contextFor = (
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Omit<ReconcileContext, 'mode'> => ({
  today,
  isSettled: (row) => hasSettlements(row, state.index),
  goals: new Map(inputs.goals.map((g) => [g.id, g])),
  activeGoalIds: new Set(state.plan.entries.map((e) => e.goal.id)),
  incomeIds: new Set(inputs.income.map((s) => s.id)),
  billIds: new Set(inputs.bills.map((b) => b.id)),
})

async function applyPlan(plan: ReconcilePlan): Promise<void> {
  const ts = new Date().toISOString()
  await insertPlanned(
    plan.create.map((d) => ({
      ...d,
      createdAt: ts,
      updatedAt: ts,
      version: '',
      dirty: 1 as const,
      deleted: 0 as const,
    })),
  )
  for (const { id, patch } of plan.update) {
    const row = await db.plannedTransactions.get(id)
    if (row) await savePlanned({ ...row, ...patch })
  }
  await removePlanned(plan.remove)
}

/** Put back a row a rewrite removed, under its own id. */
async function reinsert(row: LocalPlanned): Promise<void> {
  const queuedDelete = (await pendingPlanned(row.id).toArray()).find(
    (e) => e.op === 'delete',
  )
  if (queuedDelete?.seq !== undefined) {
    await db.outbox.delete(queuedDelete.seq)
    await savePlanned(row)
    return
  }
  // Its create never left, or its delete already did: either way the server needs it anew.
  await insertPlanned([{ ...row, version: '', dirty: 1 }])
}

async function restore(
  goalId: string,
  before: ReadonlyArray<LocalPlanned>,
  createdIds: ReadonlyArray<string>,
  snapshot: GoalPlanSnapshot,
): Promise<void> {
  await removePlanned(createdIds)
  for (const row of before) {
    const current = await db.plannedTransactions.get(row.id)
    if (!current) {
      await reinsert(row)
      continue
    }
    await savePlanned({
      ...current,
      amount: row.amount,
      walletId: row.walletId,
      name: row.name,
      categoryId: row.categoryId,
    })
  }
  await setGoalPlanSnapshot(goalId, snapshot)
  useRecalcUndoStore.getState().forget(goalId)
  schedulePush()
}

/** Rewrite one goal's future rows to the live plan and store it as the goal's plan. */
async function rewriteGoal(
  goal: LocalGoal,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Promise<{ result: RecalcResult; hadPlan: boolean }> {
  // The live plan, fitted around rows a recalc may not rewrite — so what is written, what is
  // stored as the plan and what "From today" showed are one and the same.
  const fitted = fitGoalPlanFrom(
    goal.id,
    state.desired,
    inputs.planned,
    state.index,
    inputs.rates,
    today,
  )
  const desired = state.desired
    .filter((d) => !(d.origin === 'goal' && d.goalId === goal.id))
    .concat(fitted.rows)
  const plan = reconcilePlanned(desired, inputs.planned, {
    ...contextFor(inputs, state, today),
    mode: 'recalc',
    goalId: goal.id,
  })
  const held = new Map(inputs.planned.map((p) => [p.id, p]))
  const before = [...plan.update.map((u) => u.id), ...plan.remove]
    .map((id) => held.get(id))
    .filter((p): p is LocalPlanned => !!p)
  const createdIds = plan.create.map((d) => d.id)
  await applyPlan(plan)

  const header = fitted.header
  const beforeSnapshot = snapshotFromGoal(goal)
  const after = snapshotOf(header, today)
  await setGoalPlanSnapshot(goal.id, after)

  const result: RecalcResult = {
    goalId: goal.id,
    at: today,
    before: beforeSnapshot,
    after,
    header,
    changed: {
      created: plan.create.length,
      updated: plan.update.length,
      removed: plan.remove.length,
    },
    undo: () =>
      serialized(() => restore(goal.id, before, createdIds, beforeSnapshot)),
  }
  const hadPlan =
    goal.plannedAt !== null ||
    inputs.planned.some((p) => p.origin === 'goal' && p.goalId === goal.id)
  return { result, hadPlan }
}

/** Rows read after this run's writes, so the fill's removals are already gone. */
async function resolveOrphans(
  inputs: PlannerInputs,
  state: PlannerState,
): Promise<number> {
  const rows = await db.plannedTransactions
    .where('status')
    .equals('open')
    .toArray()
  const plan = orphanedPlanned(
    rows,
    {
      goalIds: new Set(inputs.goals.map((g) => g.id)),
      incomeIds: new Set(inputs.income.map((s) => s.id)),
      billIds: new Set(inputs.bills.map((b) => b.id)),
    },
    (row) => hasSettlements(row, state.index),
  )
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const id of plan.skip)
    await savePlanned({ ...(byId.get(id) as LocalPlanned), status: 'skipped' })
  for (const id of plan.closeRest)
    await savePlanned({ ...(byId.get(id) as LocalPlanned), status: 'done' })
  return plan.skip.length + plan.closeRest.length
}

async function runOnce(
  userId: string,
  todayDate: Date,
): Promise<PlannerRunSummary> {
  const today = isoOf(todayDate)
  const inputs = await loadPlannerInputs()
  const state = derivePlannerState(inputs, userId, todayDate)
  const goals = new Map(inputs.goals.map((g) => [g.id, g]))

  const requested = new Set(takePlanRecalcRequests())
  const rewrite = [
    ...new Set([
      ...requested,
      ...inputs.goals.filter((g) => g.plannedAt === null).map((g) => g.id),
    ]),
  ].filter((id) => goals.has(id))

  const summary: PlannerRunSummary = {
    created: 0,
    updated: 0,
    removed: 0,
    rewritten: [],
    orphansResolved: 0,
  }
  for (const id of rewrite) {
    const { result, hadPlan } = await rewriteGoal(
      goals.get(id) as LocalGoal,
      inputs,
      state,
      today,
    )
    summary.created += result.changed.created
    summary.updated += result.changed.updated
    summary.removed += result.changed.removed
    summary.rewritten.push(id)
    // A plan-changing edit gets its "Plan updated · Undo"; a goal's first plan is silent.
    if (requested.has(id) && hadPlan)
      useRecalcUndoStore.getState().remember(result)
  }

  const fill = reconcilePlanned(state.desired, inputs.planned, {
    ...contextFor(inputs, state, today),
    mode: 'fill',
    skipGoalIds: new Set(rewrite),
  })
  await applyPlan(fill)
  summary.created += fill.create.length
  summary.updated += fill.update.length
  summary.removed += fill.remove.length

  summary.orphansResolved = await resolveOrphans(inputs, state)
  schedulePush()
  return summary
}

let waiting: Promise<PlannerRunSummary> | null = null

/**
 * Bring every planned row in line with its origin. Callers that arrive while a run is still
 * waiting its turn share it; one that arrives mid-run gets a fresh run after it.
 */
export function runPlanner(
  userId: string,
  today: Date = new Date(),
): Promise<PlannerRunSummary> {
  if (waiting) return waiting
  const run = serialized(() => {
    waiting = null
    return runOnce(userId, today)
  })
  waiting = run
  return run
}

/** Recalculate one goal: rewrite its future rows to today's numbers, with an undo. */
export function recalcGoalPlan(
  goalId: string,
  userId: string,
  today: Date = new Date(),
): Promise<RecalcResult | null> {
  return serialized(async () => {
    const inputs = await loadPlannerInputs()
    const goal = inputs.goals.find((g) => g.id === goalId)
    if (!goal) return null
    const state = derivePlannerState(inputs, userId, today)
    const { result } = await rewriteGoal(goal, inputs, state, isoOf(today))
    useRecalcUndoStore.getState().remember(result)
    schedulePush()
    return result
  })
}

/** "Recalculate all": every goal off its stored plan, one undo per goal. */
export async function recalcAllPlans(
  goalIds: ReadonlyArray<string>,
  userId: string,
  today: Date = new Date(),
): Promise<RecalcResult[]> {
  const out: RecalcResult[] = []
  for (const id of goalIds) {
    const result = await recalcGoalPlan(id, userId, today)
    if (result) out.push(result)
  }
  return out
}
