/**
 * The planner: brings the stored planned rows in line with the income, bills and goals they
 * come from (`generate` → `reconcile` → writes), rewrites one goal's or bill's plan on request,
 * resolves open rows whose origin is gone, and confirms what is set to happen on its own
 * (auto-pay, auto-logged income, Automatic payday set-asides — `autoConfirm.ts`).
 *
 * Every entry point runs through one queue, so a background fill, a Recalculate click and
 * an undo can never interleave their reads and writes.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalPlanned } from '#/db/types'
import { setBillPlanSnapshot } from '#/features/bills/data/mutations'
import { DEFAULT_BASE_CURRENCY } from '#/features/goals/constants'
import { setGoalPlanSnapshot } from '#/features/goals/data/mutations'
import { isPlannableGoal } from '#/features/planning/data/funding'
import { usePaydayNoticeStore } from '#/features/planned/stores/paydayNotice'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { walletSetAsides } from '#/features/setAsides/data/totals'
import { readLedgerSummary } from '#/features/transactions/data/ledgerReads'
import { convertMinor } from '#/lib/currency'
import { planningSettingsOf } from '#/features/wallets/data/mappers'
import { autoPlan, autoSettlementId } from './autoConfirm'
import type { AutoContext } from './autoConfirm'
import { isoOf } from './dates'
import { fitPlanFrom } from './fit'
import { linkedTransactions } from './linkedTransactions'
import { billOwner, goalOwner, isPlanRowOf, ownerKey } from './owners'
import type { PlanOwner } from './owners'
import { confirmPlanned } from './mutations'
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
import { snapshotFrom, snapshotOf } from './snapshot'
import type { PlanHeader, PlanSnapshot } from './snapshot'
import { derivePlannerState, liveInputs } from './state'
import type { PlannerInputs, PlannerState } from './state'

export type RecalcResult = {
  owner: PlanOwner
  /** ISO date of the rewrite. */
  at: string
  before: PlanSnapshot
  after: PlanSnapshot
  /** The rewritten plan from today on — e.g. 5 set-asides of 1,800, Oct 25 → Feb 25. */
  header: PlanHeader
  changed: { created: number; updated: number; removed: number }
  /** Restore the plan exactly as it was: same rows, same ids, same amounts. */
  undo: () => Promise<void>
}

export type PlannerRunSummary = {
  created: number
  updated: number
  removed: number
  /** Owner keys (`goal:<id>` / `bill:<id>`) whose plan was rewritten. */
  rewritten: string[]
  /** Open rows whose origin is gone: skipped, or closed with the rest abandoned. */
  orphansResolved: number
  auto: AutoSummary
}

export type AutoSummary = {
  /** Auto-pay bill payments confirmed. */
  payments: number
  /** Auto-logged paydays confirmed. */
  income: number
  /** Payday set-asides made without a tap, and their total in base currency. */
  setAsides: number
  setAsideTotal: number
  /** Payday set-asides sent to the review instead. */
  review: number
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
    settings: planningSettingsOf(settings),
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
  activeOwners: new Set(
    state.funding.tracks.map((t) => `${t.kind}:${t.ownerId}`),
  ),
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

const storeSnapshot = (owner: PlanOwner, snapshot: PlanSnapshot) =>
  owner.kind === 'goal'
    ? setGoalPlanSnapshot(owner.id, snapshot)
    : setBillPlanSnapshot(owner.id, snapshot)

async function restore(
  owner: PlanOwner,
  before: ReadonlyArray<LocalPlanned>,
  createdIds: ReadonlyArray<string>,
  snapshot: PlanSnapshot,
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
  await storeSnapshot(owner, snapshot)
  useRecalcUndoStore.getState().forget(owner)
  schedulePush()
}

const ownerRow = (owner: PlanOwner, inputs: PlannerInputs) =>
  owner.kind === 'goal'
    ? inputs.goals.find((g) => g.id === owner.id)
    : inputs.bills.find((b) => b.id === owner.id)

/** Rewrite one owner's future set-asides to the live plan and store it as its plan. */
async function rewrite(
  owner: PlanOwner,
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Promise<{ result: RecalcResult; hadPlan: boolean } | null> {
  const item = ownerRow(owner, inputs)
  if (!item) return null
  // The live plan, fitted around rows a recalc may not rewrite — so what is written, what is
  // stored as the plan and what "From today" showed are one and the same.
  const fitted = fitPlanFrom(
    owner,
    state.desired,
    inputs.planned,
    state.index,
    inputs.rates,
    today,
  )
  const desired = state.desired
    .filter((d) => !isPlanRowOf(d, owner))
    .concat(fitted.rows)
  const plan = reconcilePlanned(desired, inputs.planned, {
    ...contextFor(inputs, state, today),
    mode: 'recalc',
    owner,
  })
  const held = new Map(inputs.planned.map((p) => [p.id, p]))
  const before = [...plan.update.map((u) => u.id), ...plan.remove]
    .map((id) => held.get(id))
    .filter((p): p is LocalPlanned => !!p)
  const createdIds = plan.create.map((d) => d.id)
  await applyPlan(plan)

  const header = fitted.header
  const beforeSnapshot = snapshotFrom(item)
  const after = snapshotOf(header, today)
  await storeSnapshot(owner, after)

  const result: RecalcResult = {
    owner,
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
      serialized(() => restore(owner, before, createdIds, beforeSnapshot)),
  }
  const hadPlan =
    item.plannedAt !== null || inputs.planned.some((p) => isPlanRowOf(p, owner))
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
      billNextDue: new Map(inputs.bills.map((b) => [b.id, b.nextDue])),
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

/** Free to spend per live wallet, in its own currency: balance − what it holds set aside. */
async function freeByWallet(
  inputs: PlannerInputs,
): Promise<{ free: Record<string, number>; currency: Map<string, string> }> {
  const nodes = (await db.balanceNodes.toArray()).filter(
    (n) => n.deleted === 0 && n.kind === 'wallet',
  )
  const { deltas } = await readLedgerSummary(inputs.rates)
  const held = walletSetAsides(
    inputs.setAsides,
    inputs.goals,
    inputs.bills,
    nodes,
    inputs.rates,
  )
  const free: Record<string, number> = {}
  const currency = new Map<string, string>()
  for (const n of nodes) {
    const setAside = (held[n.id] ?? []).reduce((sum, l) => sum + l.amount, 0)
    free[n.id] = (n.amount ?? 0) + (deltas[n.id] ?? 0) - setAside
    currency.set(n.id, n.currency ?? inputs.base)
  }
  return { free, currency }
}

/** Confirm what is due to happen on its own; flag what the payday review must look at. */
async function runAuto(
  inputs: PlannerInputs,
  state: PlannerState,
  today: string,
): Promise<AutoSummary> {
  const summary: AutoSummary = {
    payments: 0,
    income: 0,
    setAsides: 0,
    setAsideTotal: 0,
    review: 0,
  }
  const rows = await db.plannedTransactions
    .where('status')
    .equals('open')
    .toArray()
  if (!rows.some((p) => p.date <= today)) return summary
  const calendar = state.funding.calendar
  const auto = inputs.settings.paydayMode === 'auto'
  const wallets = auto ? await freeByWallet(inputs) : null
  const ctx: AutoContext = {
    today,
    paydayMode: inputs.settings.paydayMode,
    bills: new Map(inputs.bills.map((b) => [b.id, b])),
    goals: new Map(inputs.goals.map((g) => [g.id, g])),
    streams: new Map(inputs.income.map((s) => [s.id, s])),
    depositWalletId:
      calendar.kind === 'paycheck' ? calendar.stream.walletId : null,
    mainStreamId: calendar.kind === 'paycheck' ? calendar.stream.id : null,
    free: wallets?.free ?? {},
    walletCurrency: wallets?.currency ?? new Map(),
    rates: inputs.rates,
    isSettled: (row) => hasSettlements(row, state.index),
  }
  const plan = autoPlan(rows, ctx)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const confirm = async (id: string, walletId: string): Promise<boolean> => {
    try {
      await confirmPlanned(id, {
        walletId,
        date: byId.get(id)?.date,
        settlementId: autoSettlementId(id),
      })
      return true
    } catch {
      // Left for the user to confirm: its wallet or category no longer fits.
      return false
    }
  }
  for (const { id, walletId } of plan.payments)
    if (await confirm(id, walletId)) summary.payments += 1
  for (const { id, walletId } of plan.income)
    if (await confirm(id, walletId)) summary.income += 1
  for (const line of plan.setAsides) {
    if (!(await confirm(line.id, line.walletId))) continue
    summary.setAsides += 1
    summary.setAsideTotal += convertMinor(
      line.amount,
      ctx.walletCurrency.get(line.walletId) ?? inputs.base,
      inputs.base,
      inputs.rates,
    )
  }
  for (const id of plan.review) {
    const row = byId.get(id)
    if (row) await savePlanned({ ...row, review: true })
  }
  summary.review = plan.review.length
  if (auto && (summary.setAsides > 0 || summary.review > 0))
    usePaydayNoticeStore.getState().show({
      at: today,
      count: summary.setAsides,
      total: summary.setAsideTotal,
      review: summary.review,
    })
  return summary
}

/** Owners that are being planned but have never had a plan written. */
const unplanned = (inputs: PlannerInputs): PlanOwner[] => [
  ...inputs.goals
    .filter((g) => isPlannableGoal(g) && g.plannedAt === null)
    .map((g) => goalOwner(g.id)),
  ...inputs.bills
    .filter((b) => b.closedAt === null && b.plannedAt === null)
    .map((b) => billOwner(b.id)),
]

async function runOnce(
  userId: string,
  todayDate: Date,
): Promise<PlannerRunSummary> {
  const today = isoOf(todayDate)
  const inputs = await loadPlannerInputs()
  const state = derivePlannerState(inputs, userId, todayDate)

  const loud = new Set<string>()
  const owners = new Map<string, PlanOwner>()
  for (const request of takePlanRecalcRequests()) {
    owners.set(ownerKey(request.owner), request.owner)
    if (!request.quiet) loud.add(ownerKey(request.owner))
  }
  for (const owner of unplanned(inputs)) owners.set(ownerKey(owner), owner)

  const summary: PlannerRunSummary = {
    created: 0,
    updated: 0,
    removed: 0,
    rewritten: [],
    orphansResolved: 0,
    auto: { payments: 0, income: 0, setAsides: 0, setAsideTotal: 0, review: 0 },
  }
  for (const [key, owner] of owners) {
    const done = await rewrite(owner, inputs, state, today)
    if (!done) continue
    const { result, hadPlan } = done
    summary.created += result.changed.created
    summary.updated += result.changed.updated
    summary.removed += result.changed.removed
    summary.rewritten.push(key)
    // A plan-changing edit gets its "Plan updated · Undo"; a first plan is silent.
    if (loud.has(key) && hadPlan) useRecalcUndoStore.getState().remember(result)
  }

  const fill = reconcilePlanned(state.desired, inputs.planned, {
    ...contextFor(inputs, state, today),
    mode: 'fill',
    skipOwners: new Set(owners.keys()),
  })
  await applyPlan(fill)
  summary.created += fill.create.length
  summary.updated += fill.update.length
  summary.removed += fill.remove.length

  summary.orphansResolved = await resolveOrphans(inputs, state)
  summary.auto = await runAuto(inputs, state, today)
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

/** Recalculate one goal or bill: rewrite its future set-asides to today's numbers, with an undo. */
export function recalcPlan(
  owner: PlanOwner,
  userId: string,
  today: Date = new Date(),
): Promise<RecalcResult | null> {
  return serialized(async () => {
    const inputs = await loadPlannerInputs()
    const state = derivePlannerState(inputs, userId, today)
    const done = await rewrite(owner, inputs, state, isoOf(today))
    if (!done) return null
    useRecalcUndoStore.getState().remember(done.result)
    schedulePush()
    return done.result
  })
}

/** "Recalculate all": every goal and bill off its stored plan, one undo each. */
export async function recalcAllPlans(
  owners: ReadonlyArray<PlanOwner>,
  userId: string,
  today: Date = new Date(),
): Promise<RecalcResult[]> {
  const out: RecalcResult[] = []
  for (const owner of owners) {
    const result = await recalcPlan(owner, userId, today)
    if (result) out.push(result)
  }
  return out
}
